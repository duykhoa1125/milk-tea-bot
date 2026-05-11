import { Request, Response } from "express";
import { bot } from "../bot/instance";
import { clearCart } from "../services/cart.service";
import {
  markOrderAsPaid,
  type PayOSWebhookPayload,
  verifyPayOSWebhookPayload,
} from "../services/payos.service";

export const handlePayOSWebhook = async (req: Request, res: Response) => {
  const payload = req.body as PayOSWebhookPayload;

  try {
    const verifiedData = await verifyPayOSWebhookPayload(payload);

    const orderCode = Number(verifiedData.orderCode);

    if (Number.isNaN(orderCode)) {
      res
        .status(200)
        .json({ success: true, ignored: true, reason: "invalid_order_code" });
      return;
    }

    const paymentResult = await markOrderAsPaid(orderCode);

    if (!paymentResult.alreadyPaid) {
      await clearCart(paymentResult.order.user.externalId);

      await bot.api.sendMessage(
        paymentResult.order.user.externalId,
        `✅ Thanh toán thành công cho đơn #${paymentResult.order.id}. Mình đã gửi đơn sang bếp, vui lòng chờ một chút nhé.`,
      );
    }

    res.json({ success: true });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "name" in error &&
      String(error.name).toLowerCase().includes("invalidsignature")
    ) {
      res.status(400).json({ error: "Invalid payOS signature" });
      return;
    }

    if (
      typeof error === "object" &&
      error &&
      "message" in error &&
      String(error.message).includes("Không tìm thấy đơn hàng")
    ) {
      res
        .status(200)
        .json({ success: true, ignored: true, reason: "order_not_found" });
      return;
    }

    console.error("PayOS webhook error:", error);
    res.status(500).json({ error: "Không thể xử lý webhook PayOS" });
  }
};
