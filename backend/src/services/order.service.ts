import "dotenv/config";
import { OrderStatus, ProductType, Prisma } from "@prisma/client";
import { getCart } from "./cart.service";
import { prisma } from "../lib/prisma";
import { config } from "../config/env";
import { createPaymentLink } from "./payos.service";

const buildPaymentItemName = (
  productName: string,
  size: string,
  toppings: string[],
) => {
  const toppingText = toppings.length > 0 ? ` + ${toppings.join(", ")}` : "";
  return `${productName} (${size})${toppingText}`.slice(0, 100);
};

export const checkout = async (
  telegramId: string,
  authorName: string,
  overallNote?: string,
) => {
  const cart = await getCart(telegramId);
  if (!cart || cart.length === 0) return { error: "Giỏ hàng rỗng" };

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

  const productById = new Map(products.map((product) => [product.id, product]));
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
        (sum, toppingName) => sum + (toppingPriceByName.get(toppingName) ?? 0),
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
      note: overallNote || null,
      items: {
        create: itemsWithPrice,
      },
    },
  });

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

  try {
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

    return {
      success: true,
      orderId: order.id,
      orderCode: order.id,
      totalPrice: calculatedTotal,
      checkoutUrl,
      paymentLinkId: paymentLinkId ?? null,
    };
  } catch (error) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED },
    });

    console.error("Create PayOS payment link failed:", error);
    return {
      error: "Không thể tạo link thanh toán. Vui lòng thử lại sau.",
    };
  }
};
