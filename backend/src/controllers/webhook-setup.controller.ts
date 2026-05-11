import { Request, Response } from "express";
import { config } from "../config/env";
import { setupTelegramWebhook } from "../services/webhook.service";

export const setupWebhookHandler = async (req: Request, res: Response) => {
  if (!config.ADMIN_API_KEY) {
    res
      .status(503)
      .json({ error: "ADMIN_API_KEY chưa được cấu hình trên server" });
    return;
  }

  const adminKey = req.header("x-admin-key") || "";

  if (adminKey !== config.ADMIN_API_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const url = await setupTelegramWebhook();
    res.send(`Webhook successfully set to: ${url}`);
  } catch (error) {
    console.error("Error setting up webhook:", error);
    res.status(500).send("Error setting up webhook.");
  }
};
