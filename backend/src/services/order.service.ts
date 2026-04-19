import "dotenv/config";
import { getCart, clearCart } from "./cart.service";
import { prisma } from "../lib/prisma";

export const checkout = async (
  telegramId: string,
  authorName: string,
  overallNote?: string,
) => {
  // 1. Lấy giỏ hàng từ Redis
  const cart = await getCart(telegramId);
  if (!cart || cart.length === 0) return { error: "Giỏ hàng rỗng" };

  // 2. Tìm hoặc Tạo Khách Hàng (Dựa trên Schema mới với externalId)
  const user = await prisma.user.upsert({
    where: { externalId: telegramId },
    update: { name: authorName },
    create: { externalId: telegramId, name: authorName },
  });

  // 3. Tính giá động: lấy priceM / priceL / priceFixed từ DB cho từng món
  let calculatedTotal = 0;

  const itemsWithPrice = await Promise.all(
    cart.map(async (item) => {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      // Ưu tiên giá theo size, fallback về priceFixed (dành cho topping)
      const unitPrice =
        item.size === "L"
          ? (product?.priceL ?? product?.priceFixed ?? 0)
          : (product?.priceM ?? product?.priceFixed ?? 0);

      calculatedTotal += unitPrice * item.quantity;

      return {
        productId: item.productId,
        size: item.size,
        unitPrice,
        quantity: item.quantity,
        toppings: item.toppings as any, // Prisma Json — mảng string tên topping
        note: item.note || null,
      };
    }),
  );

  // 4. Lưu Hóa Đơn chính xác xuống PostgreSQL
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      totalPrice: calculatedTotal,
      note: overallNote || null,
      items: {
        create: itemsWithPrice,
      },
    },
  });

  // 5. Giải phóng session Redis
  await clearCart(telegramId);

  return { success: true, orderId: order.id, totalPrice: calculatedTotal };
};
