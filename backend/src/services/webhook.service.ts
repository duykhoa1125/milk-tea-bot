import { config } from "../config/env";
import { bot } from "../bot/instance";
import { redis } from "../lib/redis";

const TELEGRAM_UPDATE_DEDUPE_TTL_SECONDS = 60 * 60 * 24;

export const isFirstTelegramUpdate = async (updateId: number) => {
  const dedupeKey = `tg:update:${updateId}`;
  const isFirstTime = await redis.set(dedupeKey, "1", {
    ex: TELEGRAM_UPDATE_DEDUPE_TTL_SECONDS,
    nx: true,
  });

  return Boolean(isFirstTime);
};

export const setupTelegramWebhook = async () => {
  const url = `${config.WEBHOOK_URL}/webhook`;

  await bot.api.setWebhook(url, {
    secret_token: config.TELEGRAM_WEBHOOK_SECRET || undefined,
    drop_pending_updates: true,
    allowed_updates: ["message", "callback_query"],
  });

  return url;
};
