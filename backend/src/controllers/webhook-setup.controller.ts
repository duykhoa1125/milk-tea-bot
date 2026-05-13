import { Request, Response } from "express";
import { setupTelegramWebhook } from "../services/webhook.service";

export const setupWebhookHandler = async (req: Request, res: Response) => {
  try {
    const url = await setupTelegramWebhook();
    res.send(`Webhook successfully set to: ${url}`);
  } catch (error) {
    console.error("Error setting up webhook:", error);
    res.status(500).send("Error setting up webhook.");
  }
};
