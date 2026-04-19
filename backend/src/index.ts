import express from "express";
import { config } from "./config/env";
import { bot, botWebhook } from "./bot/instance";
import cors from "cors";
import dashboardRouter from "./routes/dashboard.route";
import {
  markOrderAsPaid,
  type PayOSWebhookPayload,
  verifyPayOSWebhookSignature,
} from "./services/payos.service";
import { clearCart } from "./services/cart.service";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "PATCH", "POST"],
  }),
);

app.use(express.json());

//telegram transmit webhook to our server
app.post("/webhook", botWebhook);

// Kitchen dashboard API
app.use("/api", dashboardRouter);

//setup webhook manually
//run ngrok http 3000
//copy url from ngrok and paste to WEBHOOK_URL in .env file
//run npm run dev
app.get("/setup-webhook", async (req, res) => {
  try {
    const url = `${config.WEBHOOK_URL}/webhook`;
    await bot.api.setWebhook(url);
    res.send(`Webhook successfully set to: ${url}`);
  } catch (error) {
    console.error("Error setting up webhook:", error);
    res.status(500).send("Error setting up webhook.");
  }
});

app.post("/payos/webhook", async (req, res) => {
  const payload = req.body as PayOSWebhookPayload;

  try {
    if (!verifyPayOSWebhookSignature(payload)) {
      res.status(400).json({ error: "Invalid payOS signature" });
      return;
    }

    const orderCode = Number(payload.data.orderCode);

    if (Number.isNaN(orderCode)) {
      res.status(400).json({ error: "orderCode không hợp lệ" });
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
    console.error("PayOS webhook error:", error);

    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Không tìm thấy đơn hàng" });
      return;
    }

    res.status(500).json({ error: "Không thể xử lý webhook PayOS" });
  }
});

app.listen(config.PORT, () => {
  console.log(`🤖 Milk Tea Bot is running on port ${config.PORT}`);
});
