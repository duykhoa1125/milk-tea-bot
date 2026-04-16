# Hướng Dẫn Nhanh: MVP Milk Tea Bot (Bản Đơn Giản Nhất)

Đây là phiên bản **Minimum Viable Product (MVP)** cực nhanh để bạn có ngay một con bot Telegram hiểu Menu và có thể chat với khách hàng nhận order. 

Tư tưởng của phiên bản này: **Bỏ qua Database, Giao diện web, và Webhook**. Chúng ta chỉ dùng in-memory (RAM) để nhớ lịch sử chat và dùng Long-polling trên Telegram để chạy trực tiếp trên máy tính của bạn.

---

## 📌 Bước 1: Chuẩn bị 2 khóa API (Keys) quan trọng

1. **Telegram Token:** 
   - Vào Telegram, tìm **@BotFather**, gõ `/newbot`, làm theo hướng dẫn để tạo tên bot.
   - Nhận Token (ví dụ: `123456789:ABCdefGHI...`).
2. **Gemini API Key:**
   - Đăng nhập [Google AI Studio](https://aistudio.google.com).
   - Bấm **Get API Key** và tạo một key mới.

---

## 📌 Bước 2: Thiết lập dự án

Mở Terminal (hoặc PowerShell) tại thư mục dự án `milk-tea-bot` và chạy các lệnh sau:

```bash
# Khởi tạo dự án Node.js (nếu chưa có)
npm init -y

# Mở file package.json, thêm `"type": "module"` vào dưới chữ "main" 
# để cho phép dùng cú pháp 'import' thay vì 'require'

# Cài đặt 3 thư viện tối thiểu cần thiết
npm install grammy @google/generative-ai dotenv
```

Mở file `.env` (bạn đã tạo trước đó) và chắc chắn nó có định dạng như sau:
```env
TELEGRAM_TOKEN=điền_token_telegram_vào_đây
GEMINI_API_KEY=điền_key_gemini_vào_đây
```

---

## 📌 Bước 3: Code chính (Copy & Paste)

Tạo một file có tên là `index.js` ở cùng thư mục, copy và dán toàn bộ đoạn code sau vào:

```javascript
import { Bot } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// Khởi tạo các dịch vụ
const bot = new Bot(process.env.TELEGRAM_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Cấu hình Gemini với System Instruction (Dạy bot cách làm việc)
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
  model: "gemini-3-flash", // Dùng model nhanh nhất
  systemInstruction: menu,
});

// Nơi lưu trữ lịch sử chat của từng khách hàng (ChatSession)
const userChats = new Map();

// Lắng nghe khi có người nhắn tin đến Bot
bot.on("message:text", async (ctx) => {
  const chatId = ctx.msg.chat.id;
  const userText = ctx.msg.text;

  // Hồi đáp người dùng là bot đang "gõ phím..."
  await ctx.replyWithChatAction("typing");

  try {
    // Nếu khách mới, khởi tạo luồng chat (history rỗng ban đầu)
    if (!userChats.has(chatId)) {
      userChats.set(chatId, model.startChat({ history: [] }));
    }

    // Lấy luồng chat hiện tại của khách
    const chat = userChats.get(chatId);

    // Gửi tin nhắn của khách cho Gemini
    const result = await chat.sendMessage(userText);
    const botReply = result.response.text();

    // Trả lời lại trên Telegram
    await ctx.reply(botReply);
  } catch (error) {
    console.error("Lỗi:", error);
    await ctx.reply("Xin lỗi, hệ thống đang bận quá, bạn thử lại sau ít phút nhé!");
  }
});

// Bắt đầu chạy bot
console.log("🤖 Trà Sữa Bot đang khởi động...");
bot.start();
```

---

## 📌 Bước 4: Chạy thử và Tận hưởng

1. Chạy lệnh sau trong Terminal:
```bash
node index.js
```
2. Mở Telegram, tìm tên bot của bạn và ấn `/start` hoặc nhắn "Chào bạn".
3. Thử nhắn: *"Cho mình 1 cốc matcha"* -> Bot sẽ tự động hỏi bạn size và topping dựa theo menu.
4. Thử chốt đơn xem bot có tính tiền đúng không nhé!

---

## 🌟 Tiếp theo làm gì? (Khi bạn muốn nâng cấp)

Phần MVP này dùng `Map` (RAM) để lưu lịch sử, nên nếu bạn tắt Terminal (`Ctrl + C`), bot sẽ quên hết khách đang nói gì. Khi nào bạn quen với luồng này rồi, chúng ta sẽ áp dụng các công nghệ ở **Giai đoạn 2 và 3 trong file route.md** như:
- Đổi từ Long-polling (`bot.start()`) sang **Webhook** (để host lên server Vercel/Railway).
- Đưa giỏ hàng vào **Redis / Database** để không bao giờ mất dữ liệu.
- Dùng **Tool Use** của Gemini để output ra JSON thay vì chữ text, rồi lưu thẳng vào Database.
