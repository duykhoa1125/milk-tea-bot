import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import { Bot } from "grammy";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const menu = `
MENU TRÀ SỮA CỦA QUÁN:
- Trà sữa trân châu đường đen (Size M: 35k, Size L: 45k)
- Trà sữa Matcha (Size M: 30k, Size L: 40k)
- Hồng trà Kem Cheese (Size M: 40k, Size L: 50k)
- Topping thêm: Trân châu trắng (10k), Thạch phô mai (15k), Pudding trứng (10k).

YÊU CẦU DÀNH CHO BOT:
1. Bạn là nhân viên chốt đơn trà sữa thân thiện.
2. Hãy chào khách và tư vấn dựa trên menu.
3. Khi khách đặt món, luôn hỏi rõ: Số lượng, Món gì, Size nào, Có thêm topping gì không?
4. Trả lời cực kỳ ngắn gọn, tự nhiên như người thật nhắn tin.
5. Khi khách quyết định chốt đơn, hãy in ra cho khách một "Hóa đơn tạm tính" bao gồm tổng tiền.
`;

const model = genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite-preview",
  systemInstruction: menu,
});

//history of user
const userChats = new Map();

bot.on("message:text", async (ctx) => {
  const chatId = ctx.msg.chat.id;
  const userText = ctx.msg.text;

  await ctx.replyWithChatAction("typing");

  try {
    if (!userChats.has(chatId)) {
      userChats.set(chatId, model.startChat({ history: [] }));
    }

    const chat = userChats.get(chatId);

    const result = await chat.sendMessage(userText);
    const botReply = result.response.text();

    await ctx.reply(botReply);
  } catch (error) {
    console.error("Error: ", error);
    await ctx.reply(
      "Xin lỗi, hệ thống đang bận quá, bạn thử lại sau ít phút nhé!",
    );
  }
});

console.log("🤖 Trà Sữa Bot đang khởi động...");
bot.start();