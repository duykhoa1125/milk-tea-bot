# Lộ trình xây dựng AI Chatbot đặt trà sữa (Updated April 2026)

**Stack:** JavaScript · Node.js (v24+) · Gemini 3 Flash · Telegram Bot  
**Thời gian ước tính:** 6–10 tuần (nhờ sự hỗ trợ của AI Agent và SDK mới)

---

## Yêu cầu trước khi bắt đầu

- JavaScript/TypeScript cơ bản (ưu tiên TypeScript để dễ scale)
- Node.js LTS (khuyên dùng v24+) hoặc Bun v1.5+
- Google AI Studio account → lấy **Gemini 3 Flash** API key tại [aistudio.google.com](https://aistudio.google.com)
- Tài khoản Telegram (@BotFather)
- Git & GitHub
- Tài khoản Vercel, Railway hoặc Cloudflare cho Deployment

---

## Giai đoạn 1 — Nền tảng: Bot Telegram + Gemini 3 High-Speed
**Tuần 1–2**

### Việc cần làm
- Tạo bot Telegram, cấu hình Webhook (ưu tiên Webhook để có độ trễ thấp).
- Dựng server với **Hono** hoặc **Express**, tích hợp SDK `@google/generative-ai` bản mới nhất.
- **Context Caching:** Sử dụng tính năng Cache Context của Gemini để lưu trữ Menu cố định, giúp giảm 90% chi phí input và tăng tốc độ phản hồi.
- Bot trả lời thông minh về menu, topping, và có thể nhận diện hình ảnh menu/ly nước (Multimodal).

### Công nghệ & thư viện
- Gemini 3 Flash — Tốc độ xử lý cực nhanh (~1000 tokens/sec), hỗ trợ native multimodal.
- **Context Caching API** — Tối ưu hóa cho các hệ thống có System Instruction lớn.
- Hono (Web framework siêu nhẹ) hoặc Express.
- Cloudflare Tunnel (thay cho ngrok) để dev local.

```bash
pnpm add hono @google/generative-ai grammy dotenv
```

---

## Giai đoạn 2 — Đặt hàng thông minh: Tool Use & Structured Outputs
**Tuần 3–4**

### Việc cần làm
- **Native Tool Use (Function Calling):** Định nghĩa Schema để Gemini tự động gọi các hàm `addToCart`, `removeFromCart`.
- **Structured Output:** Ép kiểu phản hồi về JSON chính xác 100% bằng JSON Schema Mode.
- Xử lý ngôn ngữ tự nhiên phức tạp: "Cho một Matcha đá xay nhưng ít đá, thêm trân châu trắng và đổi thành sữa hạt".
- Lưu giỏ hàng vào **Redis** hoặc **Upstash** để đảm bảo session không bị mất khi server restart.

### Công nghệ & thư viện
- Gemini Tool Use — Tự động hóa việc xử lý logic giỏ hàng.
- **Zod** — Validate schema cho dữ liệu đầu ra từ AI.
- Upstash Redis — Serverless Redis mạnh mẽ cho AI App.
- Telegram Mini Apps (TMA) — Tích hợp giao diện web nhỏ để khách chọn topping trực quan nếu cần.

```bash
pnpm add @upstash/redis zod
```

---

## Giai đoạn 3 — Quản lý & Vận hành: Prisma + Realtime Dashboard
**Tuần 5–7**

### Việc cần làm
- **Database:** Chuyển sang dùng **Prisma** với PostgreSQL (Supabase/Neon) để quản lý đơn hàng ổn định hơn SQLite.
- **Kitchen Dashboard:** Xây dựng trang quản lý cho chủ quán bằng Next.js hoặc Vite, cập nhật đơn hàng Realtime.
- **AI Analytics:** Dùng Gemini 3 để tổng hợp báo cáo: "Món nào đang là trend?", "Khách hay phàn nàn về điều gì?".

### Công nghệ & thư viện
- **Prisma ORM** — Type-safe database access.
- **Supabase** — DB & Auth & Realtime.
- **TanStack Query** — Quản lý state và fetch dữ liệu hiệu quả.
- Socket.io hoặc Supabase Realtime.

```bash
pnpm add @prisma/client lucide-react
pnpm add -D prisma
```

---

## Giai đoạn 4 — AI Agent nâng cao & Cá nhân hóa
**Tuần 8–10**

### Việc cần làm
- **Long-term Memory:** Tích hợp Vector Database (như Pinecone hoặc Supabase Vector) để lưu lịch sử sở thích của khách hàng.
- **Voice Ordering:** Tích hợp Gemini Multi-modal Live API để khách có thể đặt hàng bằng giọng nói trực tiếp.
- **Agentic Workflow:** Bot tự động xử lý khi hết nguyên liệu (check kho và thông báo khách đổi món tự động).
- **Proactive Notification:** Gửi tin nhắn gợi ý món mới dựa trên thói quen cũ của khách (đúng khung giờ họ hay đặt).

### Công nghệ & thư viện
- **Gemini 3 Multimodal Live** — Stream audio/video trực tiếp.
- **LangChain** hoặc **Firebase Genkit** — Xây dựng Agentic Workflow.
- Pinecone / PgVector — Lưu trữ embedding.

---

## Tóm tắt tech stack 2026

| Lớp | Công nghệ khuyến dùng |
|---|---|
| Runtime | Node.js 24+ / Bun |
| AI Model | **Gemini 3 Flash** (Main), **Gemini 3 Pro** (Analytics) |
| Web Framework | Hono / Next.js |
| Database | PostgreSQL (via Prisma) |
| Cache/Session | Redis (Upstash) |
| Realtime | Supabase Realtime |
| Package Manager | **pnpm** |
| Deployment | Vercel / Railway / Cloudflare |

---

## Bước đầu tiên — làm ngay hôm nay

```bash
# 1. Lấy Gemini API key
# Vào https://aistudio.google.com → Get API Key

# 2. Nhắn @BotFather trên Telegram → /newbot → lấy token

# 3. Khởi tạo project với pnpm
mkdir milk-tea-agent && cd milk-tea-agent
pnpm init

# 4. Cài đặt dependencies
pnpm add hono @google/generative-ai grammy dotenv zod

# 5. Tạo file .env
echo "GEMINI_API_KEY=your_key" >> .env
echo "TELEGRAM_TOKEN=your_token" >> .env
```