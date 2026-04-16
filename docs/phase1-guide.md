# Hướng Dẫn Chi Tiết: Giai Đoạn 1 - Nền Tảng Bot & AI (Tuần 1-2)

Tài liệu này hướng dẫn chi tiết từng bước (step-by-step) để hoàn thành **Giai đoạn 1** của dự án AI Chatbot Đặt Trà Sữa. Mục tiêu cuối cùng của giai đoạn này là bạn có một con Bot Telegram kết nối với Express Server, có thể trò chuyện đa phương thức (văn bản & hình ảnh) bằng Gemini 3.

---

## Mở Đầu: Cấu Trúc File & Môi Trường

Đầu tiên, hãy đảm bảo bạn đã tạo tài khoản và lấy được 2 loại API Key thiết yếu:
1. **Telegram Bot Token:** Từ [@BotFather](https://t.me/botfather) trên Telegram (Gõ `/newbot`).
2. **Gemini API Key:** Từ [Google AI Studio](https://aistudio.google.com).

### 1. Khởi tạo dự án và cài đặt packages bằng npm

Chạy các lệnh sau trong terminal để khởi tạo:

```bash
mkdir milk-tea-bot
cd milk-tea-bot
npm init -y

# Cài đặt Express, Gemini SDK, library Telegram và thư viện phụ trợ
npm install express @google/generative-ai grammy dotenv

# Cài đặt các gói hỗ trợ TypeScript môi trường dev
npm install -D typescript @types/node @types/express tsx
```

### 2. Thiết lập `.env` và `tsconfig.json`

Tạo file `.env` ở thư mục gốc:

```env
TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_TOKEN_HERE"
GEMINI_API_KEY="YOUR_GEMINI_KEY_HERE"
PORT=3000
WEBHOOK_URL="https://your-ngrok-url.ngrok.app" # Sẽ cập nhật sau khi chạy ngrok / cloudflare tunnel
```

Khởi tạo và cấu hình `tsconfig.json`:

```bash
npx tsc --init
```
Update file `tsconfig.json` vừa tạo với nội dung sau:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

Mở `package.json` và thêm script start:
```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

---

## Bước 1: Thiết Lập Telegram Bot & Webhook với Express (Tuần 1)

Việc dùng Webhook giúp bot có độ phản hồi ngay lập tức (thay vì polling).
Cấu trúc thư mục cho Bước 1:
```text
src/
├── config/
│   └── env.ts
├── bot/
│   └── instance.ts
└── index.ts
```

**1. `src/config/env.ts` (Quản lý biến môi trường an toàn):**
```typescript
import 'dotenv/config';

export const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  PORT: Number(process.env.PORT) || 3000,
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
};
```

**2. `src/bot/instance.ts` (Khởi tạo bot):**
```typescript
import { Bot, webhookCallback } from 'grammy';
import { config } from '../config/env';

export const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// Các lệnh cơ bản
bot.command("start", (ctx) => ctx.reply("Chào mừng bạn tới Tiệm Trà Sữa AI! Quý khách muốn dùng gì ạ?"));
bot.command("menu", (ctx) => ctx.reply("Đây là menu của chúng tôi: Trà Sữa Trân Châu, Lục Trà, Hồng Trà..."));

// Module xuất ra middleware cho Express
export const botWebhook = webhookCallback(bot, 'express');
```

**3. `src/index.ts` (Server Express):**
```typescript
import express from 'express';
import { bot, botWebhook } from './bot/instance';
import { config } from './config/env';

const app = express();

// RẤT QUAN TRỌNG: Telegram webhook luôn gửi dạng JSON
app.use(express.json());

// Route nhận Webhook từ Telegram
app.post('/webhook', botWebhook);

// Khởi chạy Webhook bằng tay
app.get('/setup-webhook', async (req, res) => {
    try {
        const url = `${config.WEBHOOK_URL}/webhook`;
        await bot.api.setWebhook(url);
        res.send(`Webhook successfully set to: ${url}`);
    } catch (error) {
        console.error("Lỗi cài đặt webhook:", error);
        res.status(500).send("Lỗi cài đặt webhook.");
    }
});

app.listen(config.PORT, () => {
  console.log(`🤖 Trà Sữa Bot đang chạy tại http://localhost:${config.PORT}`);
});
```

*🔥 **Mẹo Test Webhook:** Cài đặt Ngrok. Chạy lệnh ngrok: `ngrok http 3000`. Lấy domain ngrok cung cấp, cập nhật vào `WEBHOOK_URL` trong file `.env`, khởi động server `npm run dev` và truy cập trình duyệt vào `http://localhost:3000/setup-webhook`.*

---

## Bước 2: Tích hợp Gemini 3 & LLM Logic (Tuần 2)

Ở bước này chúng ta sẽ tích hợp module AI để trả lời các tin nhắn tự do.

Tạo thư mục/file mới:
```text
src/
└── ai/
    ├── prompts.ts
    └── gemini.ts
```

**1. `src/ai/prompts.ts` (System Instruction & Menu):**
```typescript
export const SYSTEM_INSTRUCTION = `
Bạn là "Hoa" - một nhân viên phục vụ tiệm trà sữa cực kỳ vui vẻ, thân thiện và lễ phép.
- Hãy dùng ngôn ngữ tự nhiên, thả tim (❤️) hoặc sticker nếu phù hợp.
- Bạn phải tư vấn cho khách dựa trên MENU có sẵn.
- Trả lời thật ngắn gọn gọn, tối đa 3-4 câu. 
`;

export const MENU_DATA = `
--- MENU HÔM NAY ---
1. Trà sữa truyền thống (Size M: 30k, Size L: 40k)
2. Trà lài thanh mát (Size M: 25k, Size L: 35k)
3. Matcha đá xay (Size M: 45k)
* Topping thêm: Trân châu đen (5k), Trân châu trắng (5k), Kem cheese (10k), Hạt 3Q (10k).
* Trạng thái hôm nay: Đã hết "Hạt 3Q".
`;
```

**2. `src/ai/gemini.ts` (Tích hợp SDK):**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import { SYSTEM_INSTRUCTION, MENU_DATA } from './prompts';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// Khởi tạo model
export const chatModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash", // Hoặc gemini-3.0-flash nếu account bạn đã được update
  systemInstruction: SYSTEM_INSTRUCTION + "\n\n" + MENU_DATA,
});

export const getAIResponse = async (userPrompt: string): Promise<string> => {
    try {
        const result = await chatModel.generateContent(userPrompt);
        return result.response.text();
    } catch (e) {
        console.error("AI Error:", e);
        return "Xin lỗi anh/chị, hệ thống đang bị quá tải, anh/chị vui lòng thử lại sau vài giây nhé!";
    }
}
```

**3. Móc nối lại vào Telegram (Sửa file `src/bot/instance.ts`):**

Thêm đoạn xử lý tin nhắn vào cuối file `instance.ts`:

```typescript
import { getAIResponse } from '../ai/gemini';

// ... (code khai báo bot và /command)

// Xử lý mọi tin nhắn text mà khách gửi
bot.on("message:text", async (ctx) => {
    const userText = ctx.message.text;
    
    // Bắn trạng thái "đang gõ..."
    await ctx.replyWithChatAction("typing");

    // Lấy phản hồi từ Gemini
    const reply = await getAIResponse(userText);
    
    // Gửi trả lại khách
    await ctx.reply(reply);
});
```

---

## Bước 3: Hình Ảnh (Multimodal) & Tinh Chỉnh (Tuần 2)

Khách có thể gửi 1 bức ảnh ly trà sữa. Bot cần gửi cho Gemini phân tích hình ảnh. Bổ sung sự kiện text này vào cuối file `src/bot/instance.ts`:

```typescript
bot.on("message:photo", async (ctx) => {
    await ctx.replyWithChatAction("typing");
    
    // Lấy ID bức ảnh (chọn ảnh ở chất lượng / độ phân giải lớn nhất là phần tử cuối)
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    
    // Lấy link tải từ server Telegram
    const file = await ctx.api.getFile(photoId);
    const photoUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    // 1. Tải ảnh về 
    const response = await fetch(photoUrl);
    const arrayBuffer = await response.arrayBuffer();
    
    // 2. Wrap thành object chuẩn của Gemini Multimodal API (thành chuỗi Base64)
    const imageParts = [{
      inlineData: {
        data: Buffer.from(arrayBuffer).toString("base64"),
        mimeType: "image/jpeg"
      }
    }];
    
    // Kèm thêm (nếu khách gửi ảnh có thêm caption vào text)
    const caption = ctx.message.caption || "Ly nước trong ảnh là món gì trong menu của quán ạ?";
    
    try {
        const result = await chatModel.generateContent([caption, ...imageParts]);
        await ctx.reply(result.response.text());
    } catch(e) {
        console.error("AI Photo Error:", e);
        await ctx.reply("Xin lỗi, hệ thống có lỗi khi nhận diện hình ảnh này.");
    }
});
```

## Kiểm tra hoàn tất Giai Đoạn 1
1. Chạy server bằng: `npm run dev`.
2. Trỏ Webhook về server Express qua Ngrok và click vào API setup.
3. Chat trong Telegram để thử quy trình text & photo.

👉 **Next Step (Giai đoạn 2):** Định nghĩa function calling (Tool) để AI biết cách móc các tham số khi đặt hàng thành giỏ hàng dạng JSON lưu vào bộ nhớ Redis.
