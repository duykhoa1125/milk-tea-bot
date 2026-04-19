# AI Chatbot Đặt Trà Sữa — Kế Hoạch Dự Án Chi Tiết

> **Bối cảnh:** Quán trà sữa gần khu văn phòng, lượng đơn online tăng cao, mẹ không trả lời kịp.
> **Giải pháp:** Xây dựng AI chatbot chạy trên Telegram (và mở rộng Zalo) để tự động tiếp nhận đơn, tính tiền, và đẩy thông tin ra màn hình bếp.

---

## Mục lục

1. [Tổng quan & Mục tiêu](#1-tổng-quan--mục-tiêu)
2. [Tech Stack & Lý do chọn](#2-tech-stack--lý-do-chọn)
3. [Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Database Schema](#5-database-schema)
6. [Luồng hội thoại (Conversation FSM)](#6-luồng-hội-thoại-conversation-fsm)
7. [Gemini Function Calling Schema](#7-gemini-function-calling-schema)
8. [Kế hoạch triển khai theo giai đoạn](#8-kế-hoạch-triển-khai-theo-giai-đoạn)
9. [Xử lý lỗi & Edge Cases](#9-xử-lý-lỗi--edge-cases)
10. [Kiểm thử (Testing)](#10-kiểm-thử-testing)
11. [Deployment](#11-deployment)
12. [Điểm nhấn kỹ thuật cho Nhà tuyển dụng](#12-điểm-nhấn-kỹ-thuật-cho-nhà-tuyển-dụng)

---

## 1. Tổng quan & Mục tiêu

### Vấn đề cần giải quyết

| Vấn đề | Hậu quả | Giải pháp |
|---|---|---|
| Mẹ trả lời không kịp giờ cao điểm | Khách chờ lâu, phàn nàn | Bot phản hồi tức thì 24/7 |
| Thông tin đơn dễ thiếu, nhầm | Làm sai món, bù tiền | Structured output, xác nhận trước khi chốt |
| Không lưu lịch sử đơn hàng | Không thống kê được | Database lưu đầy đủ |
| Mẹ phải đọc chat để lấy đơn | Mất tập trung khi làm | Kitchen display realtime |

### Tính năng cốt lõi (MVP)

- Khách hỏi menu → bot giới thiệu đầy đủ (tên, giá M/L, topping có sẵn)
- Khách đặt món bằng ngôn ngữ tự nhiên → bot hiểu, xác nhận chi tiết
- Hỗ trợ sửa món, xoá món, xem lại giỏ hàng
- Tính tiền tự động, xuất bill rõ ràng
- Khách xác nhận → đơn push lên kitchen display realtime
- Mẹ nhận notification Telegram riêng mỗi khi có đơn

### Tính năng mở rộng (V2)

- Nhớ sở thích khách quen (size, độ ngọt hay dùng)
- Gợi ý món dựa theo lịch sử đặt
- Dashboard thống kê doanh thu, món bán chạy
- Hỗ trợ thanh toán QR (tích hợp VietQR)
- Zalo OA channel song song với Telegram
- Tắt/bật món hết nguyên liệu qua lệnh chat

---

## 2. Tech Stack & Lý do chọn

### Core

| Công nghệ | Version | Lý do chọn |
|---|---|---|
| **Node.js** | 20 LTS | Async event loop phù hợp webhook real-time, hệ sinh thái npm phong phú |
| **Express.js** | 4.x | Nhẹ, linh hoạt, dễ thêm middleware (rate-limit, helmet, cors) |
| **TypeScript** | 5.x | Type safety cho order schema, tránh bug runtime khi tính tiền |
| **Gemini 1.5 Flash** | latest | Free tier 15 RPM đủ dùng, function calling mạnh, context 1M token |
| **@google/generative-ai** | latest | Official SDK của Google, hỗ trợ function calling, streaming |

### Data & Cache

| Công nghệ | Lý do chọn |
|---|---|
| **better-sqlite3** | Đồng bộ, zero-config, không cần server riêng, đủ cho ~500 đơn/ngày |
| **Redis (ioredis)** | Lưu session cart theo chat_id, tự expire sau 2h không hoạt động |
| **Zod** | Validate schema đơn hàng trước khi insert DB, type-safe |

### Bot & Real-time

| Công nghệ | Lý do chọn |
|---|---|
| **node-telegram-bot-api** | Webhook mode, hỗ trợ inline keyboard, send message API đơn giản |
| **Socket.io** | Kitchen display nhận đơn mới tức thì không cần refresh |
| **node-cron** | Scheduled jobs: dọn session hết hạn, báo đơn chưa xử lý |

### Dev & Deployment

| Công nghệ | Lý do chọn |
|---|---|
| **tsx** | Chạy TypeScript trực tiếp không cần compile bước dev |
| **Jest + ts-jest** | Unit test cho order calculation, function calling parsing |
| **Winston** | Structured logging có level, xuất ra file + console |
| **Railway** | Deploy từ GitHub trong <5 phút, free tier có persistent volume cho SQLite |
| **ngrok** | Expose localhost khi dev/test webhook |

---

## 3. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────┐
│                     KHÁCH HÀNG                          │
│         Khách lẻ              Nhóm văn phòng            │
└──────────┬────────────────────────┬────────────────────-┘
           │                        │
    ┌──────▼──────┐        ┌────────▼──────┐
    │ Telegram Bot│        │    Zalo OA    │
    │  (webhook)  │        │  (webhook)    │
    └──────┬──────┘        └────────┬──────┘
           └──────────┬─────────────┘
                      ▼
            ┌─────────────────┐
            │ Webhook Gateway │  ← Express.js, rate-limit, auth token verify
            └────────┬────────┘
                     │
         ┌───────────▼──────────────┐
         │         AI Engine        │  ← Gemini 1.5 Flash
         │  - Function calling      │  ← parse đơn hàng
         │  - Multi-turn history    │  ← nhớ ngữ cảnh hội thoại
         │  - System prompt + menu  │  ← biết toàn bộ menu
         └─────┬──────────┬─────────┘
               │          │
    ┌──────────▼──┐  ┌────▼──────────┐
    │Session Mgr  │  │ Order Manager │
    │- Cart state │  │- Validate đơn │
    │- History    │  │- Tính tiền    │
    │- Redis TTL  │  │- Lưu DB       │
    └──────┬──────┘  └──────┬────────┘
           │                │
    ┌──────▼──┐    ┌─────────▼──────────┐
    │  Redis  │    │     SQLite DB       │
    │ (cache) │    │ orders/users/menu   │
    └─────────┘    └─────────┬──────────┘
                             │
                   ┌─────────▼──────────┐
                   │  Kitchen Display   │  ← Socket.io push realtime
                   │  Admin Dashboard   │  ← Chart.js, order management
                   └────────────────────┘
```

### Luồng dữ liệu một request

```
1. Khách nhắn "cho mình 2 trà sữa trân châu đen size M nhé"
2. Telegram gửi POST đến /webhook/telegram
3. Gateway verify token, parse message
4. Session Manager tải cart hiện tại từ Redis (chat_id)
5. AI Engine nhận: system_prompt + menu + chat_history + tin mới
6. Gemini trả về function call: add_to_cart({item_id: "TS01", size: "M", qty: 2})
7. Order Manager validate (item tồn tại, available=true, size hợp lệ)
8. Cart cập nhật, lưu lại Redis
9. Bot reply: "Đã thêm 2 Trà Sữa Trân Châu Đen size M (70.000đ). Bạn muốn thêm gì nữa không?"
10. Khi xác nhận → insert vào SQLite → Socket.io push tới kitchen display
```

---

## 4. Cấu trúc thư mục

```
boba-bot/
├── src/
│   ├── bot/
│   │   ├── telegram.ts          # Khởi tạo bot, đăng ký webhook
│   │   ├── zalo.ts              # Zalo OA handler (Phase 2)
│   │   └── messageRouter.ts     # Điều hướng message tới AI handler
│   │
│   ├── ai/
│   │   ├── geminiClient.ts      # Khởi tạo Gemini SDK, config
│   │   ├── systemPrompt.ts      # Build system prompt từ menu DB
│   │   ├── functionTools.ts     # Định nghĩa tất cả Gemini tools/functions
│   │   └── aiHandler.ts         # Xử lý request → gọi Gemini → xử lý response
│   │
│   ├── order/
│   │   ├── sessionManager.ts    # CRUD cart trong Redis
│   │   ├── orderManager.ts      # Validate, calculate, confirm order
│   │   ├── calculator.ts        # Pure functions tính tiền (dễ test)
│   │   └── billFormatter.ts     # Format bill text đẹp gửi lại khách
│   │
│   ├── db/
│   │   ├── connection.ts        # Khởi tạo SQLite connection
│   │   ├── migrations/
│   │   │   └── 001_init.sql     # Schema khởi tạo
│   │   ├── menuRepository.ts    # CRUD menu items
│   │   └── orderRepository.ts   # CRUD orders
│   │
│   ├── kitchen/
│   │   ├── displayServer.ts     # Socket.io server cho kitchen display
│   │   └── notifier.ts          # Push notification tới mẹ
│   │
│   ├── admin/
│   │   ├── dashboard.ts         # Express routes cho admin UI
│   │   └── analytics.ts         # Queries thống kê doanh thu
│   │
│   ├── middleware/
│   │   ├── rateLimiter.ts       # Giới hạn request/IP
│   │   ├── telegramAuth.ts      # Verify Telegram webhook token
│   │   └── errorHandler.ts      # Global error handler
│   │
│   ├── utils/
│   │   ├── logger.ts            # Winston logger config
│   │   ├── retry.ts             # Retry wrapper cho Gemini API calls
│   │   └── validators.ts        # Zod schemas
│   │
│   └── app.ts                   # Entry point, Express setup
│
├── public/
│   ├── kitchen/
│   │   └── index.html           # Kitchen display UI (Socket.io client)
│   └── admin/
│       └── index.html           # Admin dashboard UI
│
├── data/
│   └── menu.csv                 # Menu gốc (seed data)
│
├── tests/
│   ├── unit/
│   │   ├── calculator.test.ts   # Test tính tiền
│   │   └── validator.test.ts    # Test Zod schemas
│   └── integration/
│       └── orderFlow.test.ts    # Test luồng đặt hàng end-to-end
│
├── scripts/
│   └── seedMenu.ts              # Import menu.csv vào SQLite
│
├── .env.example
├── .env                         # KHÔNG commit file này
├── package.json
├── tsconfig.json
├── jest.config.ts
└── README.md
```

---

## 5. Database Schema

### Bảng `menu_items`

```sql
CREATE TABLE menu_items (
  id          TEXT PRIMARY KEY,          -- TS01, TTG01, CF01...
  category    TEXT NOT NULL,             -- Trà Sữa, Cà Phê, Topping...
  name        TEXT NOT NULL,
  description TEXT,
  price_m     INTEGER,                   -- Đơn vị: VNĐ. NULL nếu không có size M
  price_l     INTEGER,                   -- NULL nếu không có size L
  available   INTEGER NOT NULL DEFAULT 1 -- 0=hết hàng, 1=còn
);
```

### Bảng `customers`

```sql
CREATE TABLE customers (
  chat_id       TEXT PRIMARY KEY,        -- Telegram/Zalo chat_id
  platform      TEXT NOT NULL,           -- 'telegram' | 'zalo'
  display_name  TEXT,
  preferred_size TEXT,                   -- 'M' | 'L' — nhớ sở thích
  preferred_sugar TEXT,                  -- '50%', '70%'...
  order_count   INTEGER DEFAULT 0,
  first_seen    TEXT NOT NULL,           -- ISO timestamp
  last_seen     TEXT NOT NULL
);
```

### Bảng `orders`

```sql
CREATE TABLE orders (
  id            TEXT PRIMARY KEY,        -- UUID v4
  chat_id       TEXT NOT NULL,
  platform      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
                                         -- pending | preparing | ready | delivered | cancelled
  items         TEXT NOT NULL,           -- JSON array (xem format bên dưới)
  subtotal      INTEGER NOT NULL,        -- Tổng trước topping (VNĐ)
  total         INTEGER NOT NULL,        -- Tổng sau topping
  note          TEXT,                    -- Ghi chú của khách
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES customers(chat_id)
);
```

### Format JSON `orders.items`

```json
[
  {
    "item_id": "TS01",
    "name": "Trà Sữa Trân Châu Đen",
    "size": "M",
    "unit_price": 35000,
    "quantity": 2,
    "toppings": [
      { "item_id": "TOP01", "name": "Trân Châu Đen", "price": 5000 }
    ],
    "item_total": 80000
  }
]
```

### Bảng `order_status_logs`

```sql
CREATE TABLE order_status_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

---

## 6. Luồng hội thoại (Conversation FSM)

Mỗi `chat_id` có một **state** được lưu trong Redis với TTL 2 giờ.

```
STATES:
  idle          → Chưa có tương tác / hội thoại mới
  browsing      → Khách đang hỏi menu, chưa đặt gì
  ordering      → Đang thêm món vào giỏ
  reviewing     → Xem lại giỏ hàng, chưa xác nhận
  confirming    → Bot hỏi "Xác nhận đơn chưa?"
  confirmed     → Đơn đã chốt, đang làm
  cancelled     → Khách huỷ

TRANSITIONS:
  idle → browsing       : Khách gửi bất kỳ tin nhắn
  browsing → ordering   : Khách đặt món đầu tiên
  ordering → ordering   : Thêm/sửa/xoá món
  ordering → reviewing  : Khách nói "xem lại đơn" hoặc "tính tiền"
  reviewing → confirming: Bot tự chuyển sau khi hiển thị bill
  confirming → confirmed: Khách bấm "Xác nhận" hoặc gõ "đồng ý"
  confirming → ordering : Khách muốn sửa thêm
  any → cancelled       : Khách nói "huỷ" hoặc "thôi"
  confirmed → idle      : Reset sau 30 phút
```

### Ví dụ hội thoại thực tế

```
Khách: "shop ơi cho hỏi có trà gì ngon không"
Bot: "Chào bạn! Quán mình có 4 dòng chính: Trà Sữa (TS01-TS05), 
      Trà Trái Cây (TTG01-TTG05), Cà Phê (CF01-CF05) và Đá Xay. 
      Bạn thích vị nào để mình giới thiệu chi tiết hơn ạ?"

Khách: "cho 2 trà sữa trân châu đen M thêm thạch cà chua, 
        1 đá xay matcha L không topping"
Bot: "Mình đã ghi nhận:
      ✅ 2x Trà Sữa Trân Châu Đen (M) + Thạch Cà Chua — 78.000đ
      ✅ 1x Đá Xay Matcha (L) — 48.000đ
      ────────────────
      Tổng: 126.000đ
      
      Bạn muốn thêm gì nữa không, hay xác nhận đơn ạ?"

Khách: "thôi xác nhận đi"
Bot: "✅ Đơn #2024-001 đã xác nhận!
      Quán sẽ chuẩn bị ngay. Bạn đợi khoảng 10-15 phút nhé 🧋"
     [→ push tới Kitchen Display + notify mẹ]
```

---

## 7. Gemini Function Calling Schema

Đây là phần kỹ thuật quan trọng nhất. Gemini sẽ gọi các tool này thay vì trả lời text thuần.

```typescript
// src/ai/functionTools.ts

export const tools = [
  {
    functionDeclarations: [

      // Tool 1: Thêm món vào giỏ
      {
        name: "add_to_cart",
        description: "Thêm một món vào giỏ hàng của khách. Gọi khi khách muốn đặt món.",
        parameters: {
          type: "OBJECT",
          properties: {
            item_id: {
              type: "STRING",
              description: "ID của món trong menu (ví dụ: TS01, CF02, DX03)"
            },
            size: {
              type: "STRING",
              enum: ["M", "L"],
              description: "Size của đồ uống. Topping không cần size."
            },
            quantity: {
              type: "INTEGER",
              description: "Số lượng, mặc định là 1 nếu không nói rõ"
            },
            topping_ids: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Danh sách item_id của topping (TOP01, TOP02...)"
            }
          },
          required: ["item_id", "quantity"]
        }
      },

      // Tool 2: Xoá món khỏi giỏ
      {
        name: "remove_from_cart",
        description: "Xoá một món khỏi giỏ hàng. Gọi khi khách nói 'bỏ', 'xoá', 'không cần'.",
        parameters: {
          type: "OBJECT",
          properties: {
            item_id: { type: "STRING" },
            size: { type: "STRING", enum: ["M", "L"] }
          },
          required: ["item_id"]
        }
      },

      // Tool 3: Xem giỏ hàng
      {
        name: "view_cart",
        description: "Lấy danh sách các món đang trong giỏ và tổng tiền. Gọi khi khách hỏi 'đơn của mình', 'tính tiền', 'xem lại'.",
        parameters: {
          type: "OBJECT",
          properties: {}
        }
      },

      // Tool 4: Xác nhận đơn
      {
        name: "confirm_order",
        description: "Chốt đơn hàng sau khi khách đồng ý. Chỉ gọi khi khách xác nhận rõ ràng.",
        parameters: {
          type: "OBJECT",
          properties: {
            note: {
              type: "STRING",
              description: "Ghi chú đặc biệt của khách nếu có (ít đá, ít đường...)"
            }
          }
        }
      },

      // Tool 5: Huỷ đơn
      {
        name: "cancel_order",
        description: "Huỷ toàn bộ giỏ hàng. Gọi khi khách nói 'huỷ', 'thôi không đặt nữa'.",
        parameters: {
          type: "OBJECT",
          properties: {
            reason: { type: "STRING" }
          }
        }
      },

      // Tool 6: Kiểm tra món còn không
      {
        name: "check_item_availability",
        description: "Kiểm tra một món có còn phục vụ không.",
        parameters: {
          type: "OBJECT",
          properties: {
            item_id: { type: "STRING" }
          },
          required: ["item_id"]
        }
      }

    ]
  }
];
```

### Xử lý function call response

```typescript
// src/ai/aiHandler.ts

async function handleFunctionCall(
  functionName: string,
  args: Record<string, unknown>,
  chatId: string
): Promise<string> {
  switch (functionName) {
    case "add_to_cart": {
      const { item_id, size, quantity, topping_ids } = args;
      // 1. Validate item tồn tại và available
      const item = menuRepo.findById(item_id as string);
      if (!item || !item.available) return `Xin lỗi, món ${item_id} hiện không phục vụ.`;
      // 2. Tính giá
      const price = size === "L" ? item.price_l : item.price_m;
      // 3. Thêm vào Redis cart
      await sessionManager.addItem(chatId, { item, size, quantity, topping_ids, price });
      // 4. Trả về kết quả cho Gemini tiếp tục reply
      return JSON.stringify({ success: true, cart_updated: true });
    }
    // ... các case khác
  }
}
```

---

## 8. Kế hoạch triển khai theo giai đoạn

---

### Giai đoạn 1 — Nền tảng: Bot phản hồi & hiểu menu
**Thời gian: Tuần 1–2**

#### Setup dự án

```bash
mkdir boba-bot && cd boba-bot
npm init -y
npm install express @google/generative-ai node-telegram-bot-api \
            better-sqlite3 ioredis zod winston dotenv
npm install -D typescript tsx ts-node @types/node @types/express \
            @types/better-sqlite3 jest ts-jest @types/jest
npx tsc --init
```

#### Tasks chi tiết

- [ ] Cấu hình `tsconfig.json` — strict mode, paths alias `@/` → `src/`
- [ ] Tạo `.env.example` với tất cả biến môi trường cần thiết
- [ ] Viết `src/utils/logger.ts` — Winston với 3 level: info, warn, error
- [ ] Viết `src/db/connection.ts` — khởi tạo SQLite, chạy migrations
- [ ] Viết và chạy `scripts/seedMenu.ts` — import `menu.csv` vào DB
- [ ] Viết `src/ai/systemPrompt.ts` — build prompt từ menu DB, format markdown
- [ ] Viết `src/ai/geminiClient.ts` — khởi tạo SDK, config model và safety settings
- [ ] Tạo Telegram bot qua @BotFather, lưu token vào `.env`
- [ ] Viết `src/bot/telegram.ts` — set webhook URL khi start
- [ ] Viết `src/app.ts` — Express server, đăng ký route `/webhook/telegram`
- [ ] Test: nhắn "menu gì vậy" → bot trả lời đúng các món và giá
- [ ] Test: nhắn câu hỏi ngoài menu → bot từ chối lịch sự, không bịa đặt

#### System prompt template

```typescript
export function buildSystemPrompt(menuItems: MenuItem[]): string {
  const menuText = menuItems
    .filter(i => i.category !== 'Topping')
    .map(i => `- [${i.id}] ${i.name}: M=${i.price_m?.toLocaleString()}đ, L=${i.price_l?.toLocaleString()}đ`)
    .join('\n');

  const toppingText = menuItems
    .filter(i => i.category === 'Topping')
    .map(i => `- [${i.id}] ${i.name}: ${i.price_m?.toLocaleString()}đ`)
    .join('\n');

  return `Bạn là trợ lý bán hàng của quán trà sữa. Hãy xưng hô thân thiện, dùng "mình/bạn".
Chỉ tư vấn và nhận đơn các món trong menu sau, không bịa thêm món.

MENU ĐỒ UỐNG:
${menuText}

TOPPING (thêm vào bất kỳ đồ uống nào):
${toppingText}

QUY TẮC:
- Khi khách đặt món, dùng function calling để thêm vào giỏ hàng, KHÔNG tự tính tiền trong text
- Luôn hỏi size (M hoặc L) nếu khách chưa nói rõ
- Sau mỗi lần thêm món, hỏi "bạn muốn thêm gì nữa không?"
- Chỉ gọi confirm_order khi khách nói rõ "xác nhận", "đồng ý", "ok đặt"
- Khi khách hỏi giá, chỉ báo giá, không thêm vào giỏ`;
}
```

---

### Giai đoạn 2 — Luồng đặt hàng đầy đủ
**Thời gian: Tuần 3–4**

#### Tasks chi tiết

- [ ] Cài đặt Redis local (Docker: `docker run -d -p 6379:6379 redis:alpine`)
- [ ] Viết `src/order/sessionManager.ts`:
  - `getCart(chatId)` → lấy giỏ từ Redis
  - `addItem(chatId, item)` → thêm món, merge nếu trùng
  - `removeItem(chatId, itemId, size)` → xoá món
  - `clearCart(chatId)` → xoá toàn bộ
  - `setTTL(chatId, seconds)` → set expire 2h
- [ ] Viết `src/order/calculator.ts` — pure functions, dễ test:
  - `calculateItemTotal(item, toppings)` → số tiền 1 dòng
  - `calculateCartTotal(cartItems)` → tổng giỏ
- [ ] Viết `src/order/billFormatter.ts` — format bill text đẹp với emoji
- [ ] Viết `src/ai/functionTools.ts` — định nghĩa 6 tools như schema ở mục 7
- [ ] Viết `src/ai/aiHandler.ts` — orchestrate: gọi Gemini → nhận function call → xử lý → gọi lại Gemini với kết quả
- [ ] Thêm Telegram Inline Keyboard với nút "✅ Xác nhận" / "✏️ Sửa đơn" / "❌ Huỷ"
- [ ] Viết `src/middleware/telegramAuth.ts` — verify secret token trong header
- [ ] Test manual: đặt nhiều món, thêm topping, sửa số lượng, xác nhận
- [ ] Test edge case: đặt món không có trong menu → bot từ chối đúng cách

#### Conversation history management

```typescript
// Lưu lịch sử hội thoại trong Redis, không phải DB (tạm thời)
interface ChatSession {
  state: ConversationState;
  cart: CartItem[];
  history: { role: 'user' | 'model'; parts: string[] }[];
  lastActivity: number; // timestamp
}

// Giới hạn history 20 turns để tránh vượt token limit
const MAX_HISTORY_TURNS = 20;
```

---

### Giai đoạn 3 — Lưu đơn & Kitchen Display
**Thời gian: Tuần 5–6**

#### Tasks chi tiết

- [ ] Viết `src/db/migrations/001_init.sql` — tạo đầy đủ 4 bảng như schema mục 5
- [ ] Viết `src/db/orderRepository.ts`:
  - `createOrder(data)` → insert, trả về order ID
  - `updateStatus(orderId, status)` → cập nhật + log
  - `getByDateRange(from, to)` → query cho analytics
- [ ] Viết `src/kitchen/displayServer.ts`:
  - Socket.io server trên cùng Express instance
  - Event `new_order` → broadcast tới tất cả kitchen client
  - Event `order_status_change` → cập nhật realtime
- [ ] Viết `public/kitchen/index.html`:
  - Kết nối Socket.io client
  - Hiển thị danh sách đơn đang pending/preparing
  - Nút "Bắt đầu làm" → emit `start_preparing`
  - Nút "Hoàn thành" → emit `order_ready`
  - Badge đếm số đơn đang chờ
- [ ] Viết `src/kitchen/notifier.ts` — gửi Telegram message cho mẹ khi có đơn mới
- [ ] Test: đặt đơn → thấy xuất hiện trên kitchen display tức thì
- [ ] Test: bấm "Hoàn thành" → bot nhắn khách "Đơn của bạn đã sẵn sàng"

#### Kitchen Display UI (HTML đơn giản)

```html
<!-- public/kitchen/index.html -->
<div id="order-count">Đang chờ: <span id="count">0</span></div>
<div id="orders-container">
  <!-- Đơn hàng hiển thị ở đây -->
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io();
  socket.on('new_order', (order) => renderOrder(order));
  socket.on('order_updated', (order) => updateOrder(order));

  function renderOrder(order) {
    const div = document.createElement('div');
    div.className = 'order-card';
    div.id = `order-${order.id}`;
    div.innerHTML = `
      <h3>#${order.id.slice(-4)} — ${order.created_at}</h3>
      <ul>${order.items.map(i =>
        `<li>${i.quantity}x ${i.name} (${i.size}) ${i.toppings.map(t => t.name).join(', ')}</li>`
      ).join('')}</ul>
      <button onclick="startPreparing('${order.id}')">Bắt đầu làm</button>
      <button onclick="markReady('${order.id}')">Xong</button>
    `;
    document.getElementById('orders-container').prepend(div);
  }
</script>
```

---

### Giai đoạn 4 — Hoàn thiện & Tối ưu
**Thời gian: Tuần 7–8**

#### Tasks chi tiết

- [ ] Viết `src/middleware/rateLimiter.ts`:
  - 30 requests/phút per chat_id
  - 1000 requests/phút tổng toàn server
- [ ] Viết `src/utils/retry.ts` — wrapper cho Gemini API với exponential backoff:
  - Retry tối đa 3 lần khi gặp 429 (rate limit) hoặc 503 (service unavailable)
  - Delay: 1s → 2s → 4s
- [ ] Thêm graceful fallback khi Gemini timeout:
  - Sau 8 giây không response → bot nhắn "Xin lỗi, hệ thống đang bận, vui lòng thử lại"
- [ ] Viết logic "khách quen" trong `src/db/orderRepository.ts`:
  - Sau 3+ đơn, inject thông tin vào system prompt: "Khách này thường đặt size M, 70% đường"
- [ ] Viết `src/admin/analytics.ts`:
  - Doanh thu hôm nay / tuần / tháng
  - Top 5 món bán chạy
  - Giờ cao điểm (group by hour)
- [ ] Viết `public/admin/index.html` — dashboard với Chart.js
- [ ] Viết `node-cron` jobs:
  - Mỗi 30 phút: dọn sessions hết hạn trong Redis
  - Mỗi 60 phút: kiểm tra đơn pending > 45 phút → notify mẹ
- [ ] Tắt/bật món qua lệnh Telegram của mẹ: `/unavailable TS01` → `UPDATE menu_items SET available=0`
- [ ] Viết README.md đầy đủ hướng dẫn setup, deploy, và sử dụng

---

## 9. Xử lý lỗi & Edge Cases

### Các tình huống cần xử lý

| Tình huống | Xử lý |
|---|---|
| Khách đặt món không có trong menu | AI nhận diện qua system prompt, xin lỗi và gợi ý món tương tự |
| Khách đặt món `available=false` | Tool `check_availability` trả false → bot thông báo hết hàng |
| Khách nhắn bằng tiếng Anh | Gemini tự hiểu đa ngôn ngữ, không cần xử lý thêm |
| Gemini trả về text thay vì function call | Fallback: parse text tìm tên món, hoặc hỏi lại khách |
| Redis down | Fallback sang in-memory Map, log cảnh báo |
| Duplicate order (nhấn xác nhận 2 lần) | Kiểm tra idempotency key = chat_id + cart_hash |
| Khách nhắn nhiều tin nhắn liên tiếp | Queue per chat_id, xử lý tuần tự |
| Token Gemini vượt giới hạn | Tóm tắt history cũ giữ <10k token |
| Số lượng âm hoặc > 20 | Zod validation từ chối, báo lỗi rõ |

### Error handling pattern

```typescript
// src/middleware/errorHandler.ts
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error({ err, path: req.path, body: req.body });

  // Luôn trả 200 cho Telegram webhook (tránh retry storm)
  if (req.path.startsWith('/webhook')) {
    return res.status(200).json({ ok: false });
  }

  res.status(500).json({ error: 'Internal server error' });
}
```

---

## 10. Kiểm thử (Testing)

### Unit tests — Calculator

```typescript
// tests/unit/calculator.test.ts
describe('calculateCartTotal', () => {
  it('tính đúng tổng 2 món + topping', () => {
    const cart = [
      { price: 35000, quantity: 2, toppings: [{ price: 5000 }] },
      { price: 48000, quantity: 1, toppings: [] }
    ];
    expect(calculateCartTotal(cart)).toBe(123000); // (35000+5000)*2 + 48000
  });

  it('giỏ rỗng trả về 0', () => {
    expect(calculateCartTotal([])).toBe(0);
  });
});
```

### Unit tests — Zod validators

```typescript
describe('orderItemSchema', () => {
  it('reject item_id không tồn tại trong enum', () => {
    expect(() => orderItemSchema.parse({ item_id: 'FAKE99', size: 'M', quantity: 1 }))
      .toThrow();
  });

  it('reject quantity < 1', () => {
    expect(() => orderItemSchema.parse({ item_id: 'TS01', size: 'M', quantity: 0 }))
      .toThrow();
  });
});
```

### Integration test — Luồng đặt hàng

```typescript
// tests/integration/orderFlow.test.ts
it('full order flow từ add tới confirm', async () => {
  const chatId = 'test-chat-123';
  await sessionManager.clearCart(chatId);

  // Thêm món
  await handleFunctionCall('add_to_cart',
    { item_id: 'TS01', size: 'M', quantity: 1, topping_ids: ['TOP01'] },
    chatId
  );

  const cart = await sessionManager.getCart(chatId);
  expect(cart.items).toHaveLength(1);
  expect(cart.total).toBe(40000); // 35000 + 5000

  // Xác nhận đơn
  const orderId = await handleFunctionCall('confirm_order', {}, chatId);
  const order = orderRepo.findById(orderId);
  expect(order.status).toBe('pending');
});
```

### Chạy tests

```bash
npm test                    # Chạy tất cả
npm test -- --watch         # Watch mode khi dev
npm test -- --coverage      # Báo cáo coverage
```

---

## 11. Deployment

### Railway (khuyên dùng)

```bash
# 1. Kết nối GitHub repo với Railway
# 2. Thêm Redis service trong Railway dashboard
# 3. Set environment variables:
GEMINI_API_KEY=...
TELEGRAM_TOKEN=...
TELEGRAM_SECRET_TOKEN=...   # Tự tạo UUID ngẫu nhiên
REDIS_URL=...               # Railway cung cấp tự động
DATABASE_PATH=/data/boba.db # Persistent volume
NODE_ENV=production
BASE_URL=https://your-app.railway.app

# 4. Railway tự detect Node.js, build và deploy
# 5. Set Telegram webhook:
curl "https://api.telegram.org/bot${TOKEN}/setWebhook?url=${BASE_URL}/webhook/telegram&secret_token=${SECRET}"
```

### Dockerfile (optional, cho deploy linh hoạt hơn)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/app.js"]
```

### Environment variables cần thiết

```env
# .env.example
NODE_ENV=development
PORT=3000
BASE_URL=https://your-domain.com

# Telegram
TELEGRAM_TOKEN=your_bot_token_here
TELEGRAM_SECRET_TOKEN=random_uuid_for_security
TELEGRAM_ADMIN_CHAT_ID=your_personal_chat_id  # Chat ID của mẹ

# AI
GEMINI_API_KEY=your_gemini_key_here

# Database
DATABASE_PATH=./data/boba.db

# Redis
REDIS_URL=redis://localhost:6379

# Kitchen Display
KITCHEN_SECRET=random_string_to_protect_kitchen_page
```

---

## 12. Điểm nhấn kỹ thuật cho Nhà tuyển dụng

### Những gì dự án này thể hiện

**1. Hiểu về LLM trong production**
- Biết phân biệt khi nào dùng text generation vs function calling
- Hiểu token limit, conversation history management
- Xử lý hallucination: Gemini bị giới hạn bởi function schema, không thể bịa món

**2. Software architecture tốt**
- Tách biệt rõ layers: bot / AI / order / db / kitchen
- Pure functions cho business logic (calculator.ts) → dễ test
- Repository pattern cho DB access

**3. Quan tâm đến production readiness**
- Rate limiting chống spam
- Retry với exponential backoff
- Graceful fallback khi AI service down
- Idempotency cho duplicate orders
- Structured logging với Winston

**4. Real-time architecture**
- Socket.io cho kitchen display thay vì polling
- Redis cho session management với TTL tự động

**5. Developer experience**
- TypeScript strict mode
- Test coverage cho business logic
- Seed script để setup nhanh
- README đầy đủ

### Câu hỏi kỹ thuật thường gặp và cách trả lời

**"Tại sao dùng Gemini function calling thay vì parse text?"**
> Function calling ép model trả về structured JSON theo schema định sẵn. Parse text tự do sẽ fail khi khách nói "2 ly trà đen cái M size" — model extract đúng nhưng string format không đoán được. Function calling đảm bảo luôn ra `{item_id, size, quantity}` hợp lệ.

**"Tại sao Redis + SQLite thay vì chỉ dùng 1 DB?"**
> Redis cho session cart: TTL tự động, O(1) read/write, không cần xử lý cleanup. SQLite cho order history: ACID, query phức tạp, join tables. Phân công đúng tool cho đúng việc.

**"Scale lên thế nào nếu lượng đơn tăng 10x?"**
> SQLite → PostgreSQL (thay connection.ts). Redis cluster. Load balancer + sticky session. Gemini API có quota cao hơn nếu nâng plan. Kiến trúc module hóa nên thay từng lớp mà không phải viết lại.

**"Làm sao đảm bảo đơn không bị mất khi server restart?"**
> Chỉ confirmed orders mới vào SQLite (bền). Cart trong Redis là trạng thái tạm — nếu mất thì khách đặt lại, không ảnh hưởng kinh doanh. Nếu muốn bền hơn, persist cart vào SQLite với trạng thái `draft`.

---

## Tóm tắt timeline

| Giai đoạn | Nội dung | Tuần |
|---|---|---|
| 1 | Setup, bot kết nối Gemini, hiểu menu | 1–2 |
| 2 | Function calling, giỏ hàng, tính tiền | 3–4 |
| 3 | Lưu đơn SQLite, kitchen display realtime | 5–6 |
| 4 | Hoàn thiện, test, deploy, README | 7–8 |

**Thứ tự ưu tiên nếu thời gian hạn chế:**
Giai đoạn 1 + 2 (bot nhận đơn, tính tiền) → Giai đoạn 3 (kitchen display) → Giai đoạn 4 (polish)

---

*Cập nhật lần cuối theo menu chính thức: TS01–TS05, TTG01–TTG05, CF01–CF05, DX01–DX04, TOP01–TOP08*