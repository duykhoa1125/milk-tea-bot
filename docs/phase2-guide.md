# Hướng Dẫn Chi Tiết: Giai Đoạn 2 - Đặt Hàng Thông Minh (Tuần 3-4)

Trong giai đoạn này, chúng ta sẽ biến Bot từ một cỗ máy "chỉ biết nói chuyện" thành một "trợ lý ảo có khả năng thực thi tác vụ" (Agent) bằng cách sử dụng **Function Calling** của Gemini và lưu trữ thông tin giỏ hàng của User vào bộ nhớ **Redis**.

---

## Mở Đầu: Cài đặt và Môi trường

Chúng ta sẽ sử dụng [Upstash Redis](https://upstash.com/) làm bộ nhớ tạm cho Giỏ hàng vì nó hoạt động rất nhanh và dùng thông qua REST API (rất hợp với Serverless). 

### 1. Cài đặt các Package

Cài đặt SDK của Upstash và Zod (Thư viện dùng để validate dữ liệu đầu ra JSON của AI cho an toàn nếu cần, tuy nhiên Gemini SDK có syntax schema riêng, ta sẽ chủ yếu dùng cấu trúc của Gemini):

```bash
npm install @upstash/redis
```

### 2. Thiết lập cấu hình Redis

Đăng ký tài khoản trên Upstash, tạo một Redis Database (Plan Free). Lấy `REST URL` và `REST TOKEN`. 
Mở file `.env` và thêm:

```env
UPSTASH_REDIS_REST_URL="https://your-upstash-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
```

Cập nhật file `src/config/env.ts`:

```typescript
import 'dotenv/config';

export const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  PORT: Number(process.env.PORT) || 3000,
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  // Thêm Redis:
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || ''
};
```

---

## Bước 1: Xây Dựng Service Giỏ Hàng (Redis)

Tạo file quản lý giỏ hàng: `src/services/cart.service.ts`

```typescript
import { Redis } from '@upstash/redis';
import { config } from '../config/env';

const redis = new Redis({
  url: config.UPSTASH_REDIS_REST_URL,
  token: config.UPSTASH_REDIS_REST_TOKEN,
});

export interface CartItem {
  id: string; // Tự sinh (ví dụ: timestamp)
  productName: string;
  size: 'M' | 'L';
  toppings: string[];
  note: string;
  quantity: number;
}

// Lấy giỏ hàng
export const getCart = async (userId: string | number): Promise<CartItem[]> => {
  const cartItem = await redis.get<CartItem[]>(`cart:${userId}`);
  return cartItem || [];
};

// Thêm món vào giỏ
export const addToCart = async (userId: string | number, item: Omit<CartItem, 'id'>) => {
  const currentCart = await getCart(userId);
  const newItem: CartItem = {
    ...item,
    id: Date.now().toString()
  };
  currentCart.push(newItem);
  
  // Lưu lại vào redis (TTL = 1 ngày, nếu khách không chốt sẽ tự xóa)
  await redis.set(`cart:${userId}`, currentCart, { ex: 86400 });
  return currentCart;
};

// Làm sạch giỏ hàng (Sau khi thanh toán)
export const clearCart = async (userId: string | number) => {
  await redis.del(`cart:${userId}`);
};
```

---

## Bước 2: Khai báo Function Calling (Tools) cho Gemini

Chúng ta phải cho AI biết "Khả năng" (Capabilities) của chúng ta. Ta sẽ định nghĩa hàm `add_to_cart_tool`. 
Tạo file `src/ai/tools.ts`:

```typescript
import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

// Định nghĩa mô tả hàm để gửi cho Gemini
export const addToCartDeclaration: FunctionDeclaration = {
  name: "add_item_to_cart",
  description: "Gọi hàm này khi người dùng quyết định đặt thêm một món hoặc mua một món nước/trà sữa vào giỏ hàng.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      productName: {
        type: SchemaType.STRING,
        description: "Tên món nước uống khách muốn đặt (phải dựa theo menu)"
      },
      size: {
        type: SchemaType.STRING,
        description: "Kích cỡ món (chỉ được là 'M' hoặc 'L')",
      },
      toppings: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: "Danh sách topping thêm (vd: 'Trân châu đen', 'Kem cheese'). Gửi mảng rỗng nếu không có."
      },
      note: {
        type: SchemaType.STRING,
        description: "Ghi chú của khách (vd: 'ít đá', 'nhiều đường', 'không ngọt'). Nếu không có thì để trống."
      },
      quantity: {
        type: SchemaType.INTEGER,
        description: "Số lượng ly"
      }
    },
    required: ["productName", "size", "toppings", "quantity", "note"]
  }
};

export const viewCartDeclaration: FunctionDeclaration = {
  name: "view_user_cart",
  description: "Gọi hàm này khi người dùng muốn xem lại đơn hàng, hỏi xem trong giỏ hàng có gì, hoặc trước khi tính tiền để kiểm tra.",
  // Không cần tham số gì cũng được vì chúng ta sẽ tự handle UserID!
  parameters: {
      type: SchemaType.OBJECT,
      properties: {
          action: { type: SchemaType.STRING, description: "Cứ truyền chữ 'view'" }
      }
  }
};
```

---

## Bước 3: Nâng cấp AI Controller hỗ trợ Tools

Cập nhật lại file `src/ai/gemini.ts` để tích hợp `tools` và vòng lặp (Execution Loop). 

Bởi vì AI cần **lưu lại History của cuộc trò chuyện**, ta không xài `generateContent()` đơn thuần nữa mà xài `startChat()`. Nhưng với một Backend API nhét trong Webhook (Stateless), thì ta nên xử lý logic "Chat Session" như sau:

Sửa đổi toàn bộ nội dung `src/ai/gemini.ts` thành:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/env";
import { MENU_DATA, SYSTEM_INSTRUCTION } from "./prompts";
import { addToCartDeclaration, viewCartDeclaration } from "./tools";
import { addToCart, getCart } from "../services/cart.service";

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// Khởi tạo Model + Kèm với Tools
export const chatModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION + "\n\n" + MENU_DATA,
    tools: [
        {
            functionDeclarations: [addToCartDeclaration, viewCartDeclaration]
        }
    ]
});

// Cache history trên Object Tạm (Nếu server scale multi-node thì phải đưa đoạn history này vào Redis)
const chatSessions = new Map();

export const handleAIFlow = async (userId: number, userPrompt: string): Promise<string> => {
    try {
        // 1. Tạo session hoặc lấy history cũ
        if (!chatSessions.has(userId)) {
             chatSessions.set(userId, chatModel.startChat({ history: [] }));
        }
        
        const chat = chatSessions.get(userId);

        // 2. Gửi text cho Gemini
        let response = await chat.sendMessage(userPrompt);
        let aiMessage = response.response;

        // 3. VÒNG LẶP FUNCTION CALLING: Nếu Gemini "muốn" gọi hàm
        while (aiMessage.functionCalls() && aiMessage.functionCalls().length > 0) {
            const call = aiMessage.functionCalls()[0]; // Lấy hàm đầu tiên
            const funcName = call.name;
            const args = call.args;
            
            console.log(`🤖 AI is calling function: ${funcName} with arguments:`, args);

            let functionResult: any = {};

            // THỰC THI HÀM VỚI REDIS
            if (funcName === 'add_item_to_cart') {
                await addToCart(userId, {
                    productName: args.productName,
                    size: args.size, 
                    toppings: args.toppings || [],
                    note: args.note || '',
                    quantity: args.quantity
                });
                functionResult = { status: "success", message: `Đã thêm ${args.quantity} ly ${args.productName} vào giỏ.` };
            } 
            else if (funcName === 'view_user_cart') {
                const currentCart = await getCart(userId);
                functionResult = { status: "success", cart: currentCart };
            }

            // GỬI KẾT QUẢ CỦA HÀM NGƯỢC XUỐNG CHO AI 
            // AI sẽ dùng kết quả này để "nói" câu cuối cùng với khách
            response = await chat.sendMessage([{
                functionResponse: {
                    name: funcName,
                    response: functionResult
                }
            }]);
            
            aiMessage = response.response;
        }

        // KHI AI TRẢ LỜI NGÔN NGỮ TỰ NHIÊN (TEXT)
        return aiMessage.text();

    } catch (error) {
        console.error("Error generating AI response:", error);
        return "Xin lỗi anh/chị, hệ thống đang bận. Vui lòng thử lại sau.";
    }
}
```

---

## Bước 4: Chỉnh Sửa Tại Instance Bot

Quay lại file `src/bot/instance.ts`, sửa lại gọi hàm `getAIResponse` thành hàm `handleAIFlow` mà chúng ta vừa định nghĩa. 

Sửa đoạn `bot.on("message:text"...)` của bạn:

```typescript
import { handleAIFlow } from '../ai/gemini';

// (các code command không dổi...)

bot.on("message:text", async (ctx) => {
    const userText = ctx.message.text;
    const userId = ctx.from.id; // Lấy ID của khách 
    
    await ctx.replyWithChatAction("typing");

    // Thay vì getAIResponse(userText), truyền userId vào:
    const replyText = await handleAIFlow(userId, userText);

    await ctx.reply(replyText);
});
```

---

## Kiểm Tra Đầu Ra Giai Đoạn 2

1. Khởi động lại Server: `npm run dev`
2. Nhắn tin cho Bot:
   - Bạn gõ: *"Lấy cho anh 2 cốc hồng trà size M thêm trân châu trắng, ít đá"*
   - 👉 Xem Console log: Bạn sẽ thấy hiện dòng lệnh AI chuẩn bị gọi `add_item_to_cart` với tham số JSON rõ ràng.
   - 👉 Bot trả lời: *"Dạ vâng em đã thêm 2 ly Hồng trà kem cheese (size M, thêm hạt ngọc trai, ít đá) vào giỏ hàng rồi ạ. Anh lấy thêm gì nữa không? ❤️"*
3. Bạn nhắn tiếp: 
   - *"Tính tiền"* hoặc *"Cho anh xem giỏ hàng"*
   - 👉 Xem Console log: AI sẽ nhận diện ngữ cảnh, gọi hàm `view_user_cart`. Bot sẽ tự tóm tắt lại tổng hợp các món trong giỏ.

👉 **Next Step (Giai đoạn 3):** Giai đoạn tới chúng ta sẽ bổ sung Prisma Database và một route Web (Hono/Express / Next.js) để in bill ra cho Nhà bếp làm nước.
