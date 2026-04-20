import express from "express";
import { config } from "./config/env";
import { bot, botWebhook } from "./bot/instance";
import cors from "cors";
import dashboardRouter from "./routes/dashboard.route";
import {
  markOrderAsPaid,
  type PayOSWebhookPayload,
  verifyPayOSWebhookPayload,
} from "./services/payos.service";
import { clearCart } from "./services/cart.service";
import { redis } from "./lib/redis";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "PATCH", "POST"],
  }),
);

app.use(express.json());

//telegram transmit webhook to our server
app.post("/webhook", async (req, res) => {
  const updateId = (req.body as { update_id?: number })?.update_id;

  if (typeof updateId === "number") {
    const dedupeKey = `tg:update:${updateId}`;
    const isFirstTime = await redis.set(dedupeKey, "1", {
      ex: 60 * 60 * 24,
      nx: true,
    });

    if (!isFirstTime) {
      // Ignore duplicated Telegram retries safely.
      res.status(200).json({ ok: true, deduped: true });
      return;
    }
  }

  await botWebhook(req, res);
});

// Kitchen dashboard API
app.use("/api", dashboardRouter);

//setup webhook manually
//run ngrok http 3000
//copy url from ngrok and paste to WEBHOOK_URL in .env file
//run npm run dev
app.get("/setup-webhook", async (req, res) => {
  try {
    const url = `${config.WEBHOOK_URL}/webhook`;
    await bot.api.setWebhook(url, {
      secret_token: config.TELEGRAM_WEBHOOK_SECRET || undefined,
      drop_pending_updates: true,
      allowed_updates: ["message", "callback_query"],
    });
    res.send(`Webhook successfully set to: ${url}`);
  } catch (error) {
    console.error("Error setting up webhook:", error);
    res.status(500).send("Error setting up webhook.");
  }
});

app.post("/payos/webhook", async (req, res) => {
  const payload = req.body as PayOSWebhookPayload;

  try {
    const verifiedData = await verifyPayOSWebhookPayload(payload);

    const orderCode = Number(verifiedData.orderCode);

    if (Number.isNaN(orderCode)) {
      // Accept unknown validation payloads from provider but skip business processing.
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
    // Signature must be valid for real webhook callbacks.
    if (
      typeof error === "object" &&
      error &&
      "name" in error &&
      String(error.name).toLowerCase().includes("invalidsignature")
    ) {
      res.status(400).json({ error: "Invalid payOS signature" });
      return;
    }

    // For webhook URL validation/test events, PayOS may send non-business order codes.
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
});

app.listen(config.PORT, () => {
  console.log(`🤖 Milk Tea Bot is running on port ${config.PORT}`);
});
