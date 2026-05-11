import { Request, Response } from "express";
import { botWebhook } from "../bot/instance";
import { isFirstTelegramUpdate } from "../services/webhook.service";

export const handleTelegramWebhook = async (req: Request, res: Response) => {
  const updateId = (req.body as { update_id?: number })?.update_id;

  if (typeof updateId === "number") {
    const isFirstTime = await isFirstTelegramUpdate(updateId);

    if (!isFirstTime) {
      res.status(200).json({ ok: true, deduped: true });
      return;
    }
  }

  await botWebhook(req, res);
};
