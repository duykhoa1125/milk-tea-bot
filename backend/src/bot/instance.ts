import { Bot, Keyboard, InlineKeyboard, webhookCallback } from "grammy";
import { config } from "./../config/env";
import { chatModel, handleAIFlow } from "../ai/gemini";
import {
  getMenuForUserText,
  getMenuPromptText,
  sendMenuWithInlineKeyboard,
} from "../services/menu.service";
import { getCart, addToCart, clearCart } from "../services/cart.service";
import { checkout } from "../services/order.service";
import { prisma } from "../lib/prisma";

const MENU_INTENT_REGEX =
  /\b(menu|thuc\s*don|thực\s*đơn|co\s*mon\s*gi|có\s*món\s*gì|ban\s*gi|bán\s*gì)\b/i;

const ORDER_INTENT_REGEX =
  /\b(dat|đặt|mua|them|thêm|goi|gọi|order|chot|chốt|thanh\s*toan|thanh\s*toán|checkout|size|topping|\d+\s*(ly|coc|cốc))\b/i;

const isMenuOnlyIntent = (text: string) =>
  MENU_INTENT_REGEX.test(text) && !ORDER_INTENT_REGEX.test(text);

//initialize bot
export const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

//common command
const mainKeyboard = new Keyboard()
  .text("📋 Xem Menu")
  .text("🛒 Giỏ hàng")
  .row()
  .text("📞 Liên hệ")
  .text("💬 Chat với Nhân viên")
  .resized();

bot.command("start", (ctx) =>
  ctx.reply("Chào mừng bạn tới Tiệm Trà Sữa AI! Quý khách muốn dùng gì ạ?", {
    reply_markup: mainKeyboard,
  }),
);
bot.command("menu", async (ctx) => {
  try {
    await sendMenuWithInlineKeyboard(ctx);
  } catch (error) {
    console.error("Menu command error:", error);
    await ctx.reply(
      "Xin lỗi, hiện tại không thể tải menu. Vui lòng thử lại sau.",
    );
  }
});

//handle all text messages
bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || "Khách";
  const userText = ctx.message.text;

  if (userText === "📋 Xem Menu") {
    await sendMenuWithInlineKeyboard(ctx);
    return;
  }

  if (userText === "🛒 Giỏ hàng") {
    const cart = await getCart(String(userId));
    if (!cart || cart.length === 0) {
      await ctx.reply("Giỏ hàng của bạn đang trống. Hãy thêm món vào giỏ nhé!");
      return;
    }

    const cartText = cart
      .map(
        (item) =>
          `- ${item.quantity}x ${item.productName} (Size ${item.size})` +
          (item.toppings.length ? ` + ${item.toppings.join(", ")}` : "") +
          (item.note ? `\n  Ghi chú: ${item.note}` : "")
      )
      .join("\n");

    const cartKeyboard = new InlineKeyboard()
      .text("💳 Thanh toán ngay", "checkout_cart")
      .row()
      .text("🗑 Xóa giỏ hàng", "clear_cart");

    await ctx.reply(`🛒 Giỏ hàng của bạn:\n\n${cartText}`, {
      reply_markup: cartKeyboard,
    });
    return;
  }

  if (userText === "📞 Liên hệ") {
    await ctx.reply("Hotline: 0123.456.789\nĐịa chỉ: 123 Đường Cà Phê, Quận 1, TP. HCM");
    return;
  }

  if (userText === "💬 Chat với Nhân viên") {
    await ctx.reply("Đang kết nối với nhân viên... Vui lòng đợi trong giây lát, hoặc tiếp tục chat với Bot nhé!");
    return;
  }

  await ctx.replyWithChatAction("typing");

  if (isMenuOnlyIntent(userText)) {
    await sendMenuWithInlineKeyboard(ctx);
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
    const menuContext = await getMenuPromptText();
    const result = await chatModel.generateContent([
      `${menuContext}\n\nHãy nhận diện món trong ảnh dựa trên menu ở trên. Chỉ xác nhận "có trong menu" nếu khớp rõ ràng với một món có sẵn. Nếu ảnh giống một món trong menu nhưng cách gọi của khách khác đi, hãy dùng tên chuẩn của menu. Nếu không chắc, hãy nói đó là món gần nhất trong menu và hỏi lại ngắn gọn.\n\nTin nhắn/caption của khách: ${caption}`,
      ...imageParts,
    ]);
    await ctx.reply(result.response.text());
  } catch (error) {
    console.error("AI Photo Error:", error);
    await ctx.reply("Xin lỗi, hệ thống có lỗi khi nhận diện hình ảnh này.");
  }
});

//handle inline keyboard callback queries
bot.on("callback_query:data", async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || "Khách";
  const data = ctx.callbackQuery.data;

  try {
    if (data === "checkout_cart") {
      const result = await checkout(String(userId), userName, "");

      if ("error" in result && result.error) {
        await ctx.answerCallbackQuery();
        await ctx.reply(`Lỗi chốt đơn: ${result.error}`);
        return;
      }

      await ctx.answerCallbackQuery({ text: "Đang tạo đơn hàng..." });

      if (result && "checkoutUrl" in result) {
        await ctx.reply(
          `Đơn #${result.orderId} đã được tạo.\nTổng tiền: ${result.totalPrice?.toLocaleString("vi-VN")}đ\nThanh toán tại đây: ${result.checkoutUrl}\nSau khi thanh toán thành công, hệ thống sẽ tự cập nhật trạng thái đơn.`
        );
      }
    } else if (data === "clear_cart") {
      await clearCart(userId);
      await ctx.answerCallbackQuery({ text: "Đã xóa toàn bộ giỏ hàng!", show_alert: true });
      await ctx.editMessageText("Giỏ hàng của bạn đã được làm trống.");
    } else if (data.startsWith("add_")) {
      const parts = data.split("_");
      // Format: add_{size}_{productId}
      if (parts.length === 3) {
        const sizeStr = parts[1];
        const productId = parts[2];

        const product = await prisma.product.findUnique({
          where: { id: productId },
        });

        if (product) {
          await addToCart(userId, {
            productId: product.id,
            productName: product.name,
            size: sizeStr as "M" | "L",
            toppings: [],
            note: "",
            quantity: 1,
          });

          const sizeText = sizeStr === "M" || sizeStr === "L" ? ` (${sizeStr})` : "";
          await ctx.answerCallbackQuery({
            text: `Đã thêm ${product.name}${sizeText} vào giỏ hàng!`,
            show_alert: true,
          });
        } else {
          await ctx.answerCallbackQuery({
            text: "Không tìm thấy món này trong hệ thống.",
          });
        }
      }
    }
  } catch (error) {
    console.error("Callback query error:", error);
    await ctx.answerCallbackQuery({
      text: "Đã xảy ra lỗi khi xử lý yêu cầu của bạn.",
    });
  }
});

// Module export middleware for Express
export const botWebhook = webhookCallback(bot, "express", {
  // Return a response before Telegram hits the hard 10s webhook timeout.
  onTimeout: "return",
  timeoutMilliseconds: 9_500,
  secretToken: config.TELEGRAM_WEBHOOK_SECRET || undefined,
});
