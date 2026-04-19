import { OrderStatus } from "@prisma/client";
import { Request, Response } from "express";
import {
  getActiveOrders,
  updateOrderStatus,
} from "../services/dashboard.service";

const ALLOWED_STATUS = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.COOKING,
  OrderStatus.DONE,
  OrderStatus.CANCELLED,
]);

export const getOrdersHandler = async (_req: Request, res: Response) => {
  try {
    const orders = await getActiveOrders();
    res.json(orders);
  } catch (error) {
    console.error("Error fetching dashboard orders:", error);
    res.status(500).json({ error: "Không thể lấy danh sách đơn hàng" });
  }
};

export const updateOrderStatusHandler = async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  const status = req.body?.status as OrderStatus;

  if (Number.isNaN(orderId)) {
    res.status(400).json({ error: "orderId không hợp lệ" });
    return;
  }

  if (!status || !ALLOWED_STATUS.has(status)) {
    res.status(400).json({ error: "status không hợp lệ" });
    return;
  }

  try {
    const updatedOrder = await updateOrderStatus(orderId, status);

    if (status === OrderStatus.DONE && updatedOrder.user?.externalId) {
      const message = `✅ Đơn hàng #${orderId} của bạn đã sẵn sàng! Mời bạn đến lấy đồ nhé ☕`;
      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: updatedOrder.user.externalId,
            text: message,
          }),
        },
      );
    }

    res.json(updatedOrder);
  } catch (error: unknown) {
    console.error("Error updating order status:", error);
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Không tìm thấy đơn hàng" });
      return;
    }

    res.status(500).json({ error: "Không thể cập nhật trạng thái đơn hàng" });
  }
};
