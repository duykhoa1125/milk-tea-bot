import { Bot, webhookCallback } from "grammy";
import { config } from "./../config/env";
import { chatModel, handleAIFlow } from "../ai/gemini";
import { getMenuForUserText } from "../services/menu.service";

const MENU_INTENT_REGEX =
  /\b(menu|thuc\s*don|thực\s*đơn|co\s*mon\s*gi|có\s*món\s*gì|ban\s*gi|bán\s*gì)\b/i;

const ORDER_INTENT_REGEX =
  /\b(dat|đặt|mua|them|thêm|goi|gọi|order|chot|chốt|thanh\s*toan|thanh\s*toán|checkout|size|topping|\d+\s*(ly|coc|cốc))\b/i;

const isMenuOnlyIntent = (text: string) =>
  MENU_INTENT_REGEX.test(text) && !ORDER_INTENT_REGEX.test(text);

//initialize bot
export const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

//common command
bot.command("start", (ctx) =>
  ctx.reply("Chào mừng bạn tới Tiệm Trà Sữa AI! Quý khách muốn dùng gì ạ?"),
);
bot.command("menu", async (ctx) => {
  try {
    const menuText = await getMenuForUserText();
    await ctx.reply(menuText);
  } catch (error) {
    console.error("Menu command error:", error);
    await ctx.reply(
      "Xin loi, hien tai khong the tai menu. Vui long thu lai sau.",
    );
  }
});

//handle all text messages
bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || "Khách";
  const userText = ctx.message.text;

  await ctx.replyWithChatAction("typing");

  if (isMenuOnlyIntent(userText)) {
    const menuText = await getMenuForUserText();
    await ctx.reply(menuText);
    return;
  }

  const replyText = await handleAIFlow(userId, userName, userText);

  await ctx.reply(replyText);
});

//handle all photo
bot.on("message:photo", async (ctx) => {
  const userId = ctx.from.id;
  await ctx.replyWithChatAction("typing");

  // Get image ID (select the image with the highest quality / resolution is the last element)
  const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

  // Get download link from Telegram server
  const file = await ctx.api.getFile(photoId);
  const photoUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

  // 1. Download image
  const response = await fetch(photoUrl);
  const arrayBuffer = await response.arrayBuffer();

  // 2.Wrap to object Gemini Multimodal API (Base64)
  const imageParts = [
    {
      inlineData: {
        data: Buffer.from(arrayBuffer).toString("base64"),
        mimeType: "image/jpeg",
      },
    },
  ];

  // 3.if user send caption
  const caption = ctx.message.caption || "What is this drink in the picture?";

  try {
    const result = await chatModel.generateContent([caption, ...imageParts]);
    await ctx.reply(result.response.text());
  } catch (error) {
    console.error("AI Photo Error:", error);
    await ctx.reply("Xin lỗi, hệ thống có lỗi khi nhận diện hình ảnh này.");
  }
});

// Module export middleware for Express
export const botWebhook = webhookCallback(bot, "express", {
  // Return a response before Telegram hits the hard 10s webhook timeout.
  onTimeout: "return",
  timeoutMilliseconds: 9_500,
  secretToken: config.TELEGRAM_WEBHOOK_SECRET || undefined,
});
