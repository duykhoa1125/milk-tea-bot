import "dotenv/config";
import crypto from "node:crypto";
import { OrderStatus, ProductType, Prisma } from "@prisma/client";
import { getCart } from "./cart.service";
import { prisma } from "../lib/prisma";
import { config } from "../config/env";
import { createPaymentLink } from "./payos.service";
import { redis } from "../lib/redis";

export const invalidatePendingPaymentOrders = async (telegramId: string) => {
  const result = await prisma.order.updateMany({
    where: {
      telegramId,
      status: OrderStatus.PENDING_PAYMENT,
    },
    data: {
      status: OrderStatus.CANCELLED,
    },
  });

  return result.count;
};

const buildPaymentItemName = (
  productName: string,
  size: string,
  toppings: string[],
) => {
  const toppingText = toppings.length > 0 ? ` + ${toppings.join(", ")}` : "";
  return `${productName} (${size})${toppingText}`.slice(0, 100);
};

const createCheckoutFingerprint = (
  telegramId: string,
  overallNote: string,
  cart: Awaited<ReturnType<typeof getCart>>,
) => {
  const normalizedItems = cart
    .map((item) => ({
      productId: item.productId,
      size: item.size,
      quantity: item.quantity,
      note: (item.note || "").trim(),
      toppings: [...item.toppings].sort(),
    }))
    .sort((a, b) => {
      const keyA = `${a.productId}|${a.size}|${a.quantity}|${a.note}|${a.toppings.join(",")}`;
      const keyB = `${b.productId}|${b.size}|${b.quantity}|${b.note}|${b.toppings.join(",")}`;
      return keyA.localeCompare(keyB);
    });

  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        telegramId,
        overallNote: (overallNote || "").trim(),
        items: normalizedItems,
      }),
    )
    .digest("hex");
};

export const checkout = async (
  telegramId: string,
  authorName: string,
  overallNote?: string,
) => {
  const normalizedNote = (overallNote || "").trim();
  const cart = await getCart(telegramId);
  if (!cart || cart.length === 0) return { error: "Giỏ hàng rỗng" };

  const fingerprint = createCheckoutFingerprint(
    telegramId,
    normalizedNote,
    cart,
  );
  const lockKey = `checkout:lock:${telegramId}`;
  const resultKey = `checkout:result:${fingerprint}`;
  const lockToken = crypto.randomUUID();
  let createdOrderId: number | null = null;

  const acquiredLock = await redis.set(lockKey, lockToken, {
    nx: true,
    ex: 30,
  });

  if (!acquiredLock) {
    const cachedResult = await redis.get<Record<string, unknown>>(resultKey);

    if (cachedResult) {
      return cachedResult as {
        success?: boolean;
        error?: string;
        orderId?: number;
        orderCode?: number;
        totalPrice?: number;
        checkoutUrl?: string;
        paymentLinkId?: string | null;
      };
    }

    return {
      error:
        "Hệ thống đang xử lý thanh toán cho yêu cầu này. Vui lòng đợi vài giây và thử lại.",
    };
  }

  try {
    const productIds = [...new Set(cart.map((item) => item.productId))];
    const toppingNames = [...new Set(cart.flatMap((item) => item.toppings))];

    const [products, toppingProducts] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          priceM: true,
          priceL: true,
          priceFixed: true,
        },
      }),
      toppingNames.length > 0
        ? prisma.product.findMany({
            where: {
              name: { in: toppingNames },
              type: ProductType.TOPPING,
            },
            select: {
              name: true,
              priceFixed: true,
            },
          })
        : Promise.resolve(
            [] as Array<{ name: string; priceFixed: number | null }>,
          ),
    ]);

    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const toppingPriceByName = new Map(
      toppingProducts.map((product) => [product.name, product.priceFixed ?? 0]),
    );

    const user = await prisma.user.upsert({
      where: { externalId: telegramId },
      update: { name: authorName },
      create: { externalId: telegramId, name: authorName },
    });

    let calculatedTotal = 0;

    const itemsWithPrice = await Promise.all(
      cart.map(async (item) => {
        const product = productById.get(item.productId);

        if (!product) {
          throw new Error(`Không tìm thấy sản phẩm ${item.productId}`);
        }

        const unitPrice =
          item.size === "L"
            ? (product.priceL ?? product.priceFixed ?? 0)
            : (product.priceM ?? product.priceFixed ?? 0);

        const toppingPrice = item.toppings.reduce(
          (sum, toppingName) =>
            sum + (toppingPriceByName.get(toppingName) ?? 0),
          0,
        );

        const finalUnitPrice = unitPrice + toppingPrice;

        calculatedTotal += finalUnitPrice * item.quantity;

        return {
          productId: item.productId,
          size: item.size,
          unitPrice: finalUnitPrice,
          quantity: item.quantity,
          toppings: item.toppings as Prisma.JsonArray,
          note: item.note || null,
        };
      }),
    );

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        totalPrice: calculatedTotal,
        status: OrderStatus.PENDING_PAYMENT,
        telegramId,
        note: normalizedNote || null,
        items: {
          create: itemsWithPrice,
        },
      },
    });

    createdOrderId = order.id;

    const paymentItems = cart.map((item) => {
      const product = productById.get(item.productId);

      if (!product) {
        throw new Error(`Không tìm thấy sản phẩm ${item.productId}`);
      }

      const basePrice =
        item.size === "L"
          ? (product.priceL ?? product.priceFixed ?? 0)
          : (product.priceM ?? product.priceFixed ?? 0);
      const toppingPrice = item.toppings.reduce(
        (sum, toppingName) => sum + (toppingPriceByName.get(toppingName) ?? 0),
        0,
      );

      return {
        name: buildPaymentItemName(product.name, item.size, item.toppings),
        quantity: item.quantity,
        price: basePrice + toppingPrice,
      };
    });

    const paymentLinkResponse = await createPaymentLink({
      orderCode: order.id,
      amount: calculatedTotal,
      description: `DH${order.id}`,
      items: paymentItems,
      returnUrl: `${config.FRONTEND_URL}/success`,
      cancelUrl: `${config.FRONTEND_URL}/cancel`,
    });

    const checkoutUrl =
      paymentLinkResponse.checkoutUrl ??
      (paymentLinkResponse as { data?: { checkoutUrl?: string } }).data
        ?.checkoutUrl;
    const paymentLinkId =
      paymentLinkResponse.paymentLinkId ??
      (paymentLinkResponse as { data?: { paymentLinkId?: string } }).data
        ?.paymentLinkId;

    if (!checkoutUrl) {
      throw new Error("PayOS không trả về checkoutUrl");
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentLinkId: paymentLinkId ?? null },
    });

    const successResult = {
      success: true,
      orderId: order.id,
      orderCode: order.id,
      totalPrice: calculatedTotal,
      checkoutUrl,
      paymentLinkId: paymentLinkId ?? null,
    };

    await redis.set(resultKey, successResult, { ex: 60 * 5 });
    return successResult;
  } catch (error) {
    if (createdOrderId) {
      await prisma.order.update({
        where: { id: createdOrderId },
        data: { status: OrderStatus.CANCELLED },
      });
    }

    console.error("Create PayOS payment link failed:", error);
    const errorResult = {
      error: "Không thể tạo link thanh toán. Vui lòng thử lại sau.",
    };

    await redis.set(resultKey, errorResult, { ex: 30 });
    return errorResult;
  } finally {
    const currentLockValue = await redis.get<string>(lockKey);
    if (currentLockValue === lockToken) {
      await redis.del(lockKey);
    }
  }
};
