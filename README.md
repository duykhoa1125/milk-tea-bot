# 🧋 Tiệm Trà Sữa AI - Replica Bot của Mẹ

[![Demo Video](https://img.shields.io/badge/Demo-Video-red?style=for-the-badge&logo=youtube)](https://www.youtube.com/watch?v=gtaLfLT-CCw)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue?style=for-the-badge&logo=telegram)](https://t.me/milkteaorder_bot)
[![Live Dashboard](https://img.shields.io/badge/Live-Dashboard-green?style=for-the-badge&logo=vercel)](https://milk-tea-bot-frontend.vercel.app/)

Dự án phát triển một "bản sao AI" đóng vai trò là cô chủ tiệm trà sữa. Bot hoạt động trực tiếp qua **Telegram**, trò chuyện tự nhiên với khách hàng để tư vấn các loại đồ uống kèm topping, sau đó sinh link thanh toán (via PayOS). Ngay khi khách thanh toán thành công, hệ thống tự động đẩy đơn hàng sang giao diện **Kitchen Dashboard** dành cho nhà bếp chuẩn bị món ăn.
---

## 🔗 Demo & Trải nghiệm

- **Video Demo**: [YouTube Link](https://www.youtube.com/watch?v=gtaLfLT-CCw)
- **Telegram Bot**: [@milkteaorder_bot](https://t.me/milkteaorder_bot)
- **Kitchen Dashboard (Live)**: [milk-tea-bot-frontend.vercel.app](https://milk-tea-bot-frontend.vercel.app/)

---

## ✨ Tính năng nổi bật

1. **AI Chat & Tư vấn thông minh**: Sử dụng **Gemini AI** (kết hợp *Function Calling*) để trò chuyện tự nhiên. Bot không chỉ lặp lại menu mà còn giao tiếp mượt mà, phản hồi có cảm xúc, linh hoạt nhận các yêu cầu đặc biệt của khách hàng (VD: bớt đá, không đường, vân vân).
2. **Hỗ trợ xử lý hình ảnh (Multimodal)**: Khách hàng có thể gửi ảnh các loại ly trà sữa. Bot có thể dự đoán và hỗ trợ nhận diện món đồ uống.
3. **Quản lý Giỏ Hàng (Cart)**: 
   - Thêm món, xóa món, điều chỉnh topping, thay đổi phân loại (Size M/L).
   - Redis dùng để lưu session giỏ hàng mượt mà mà không lo tốn chi phí read/write DB chính.
4. **Tích hợp thanh toán PayOS**: 
   - Sinh QR Code hoặc link chuyển khoản tự động. 
   - Ghi nhận trạng thái "Đã thanh toán" để báo bếp ngay khi có IPN từ webhook ngân hàng.
5. **Kitchen Dashboard (Next.js)**:
   - Một giao diện riêng (Frontend) hiển thị danh sách đơn Order theo thời gian thực.
   - Giao diện đẹp mắt.

---

## 🛠 Tech Stack

Dự án được xây dựng theo kiến trúc **Monorepo** với 2 phần chính.

### 1. Backend (Logic & Database)
- **Runtime**: Node.js + Express
- **Bot Framework**: `grammy` (Webhook mechanism để đảm bảo scale tốt).
- **AI Model**: `@google/generative-ai` (Gemini Pro / Flash Lite).
- **Cơ sở dữ liệu chính**: PostgreSQL (phát triển qua serverless NeonDB) đi kèm Prisma ORM.
- **Cache/Session**: Redis (sử dụng Upstash serverless Redis).
- **Thanh toán**: `@payos/node` (PayOS API).

### 2. Frontend (Kitchen Dashboard)
- **Framework**: Next.js (App Router) + React 19.
- **Styling**: TailwindCSS 4, `lucide-react`.

---

## 📂 Project Structure

```
milk-tea-bot/
├── backend/                  # Nơi chứa API, webhook, và AI core.
│   ├── csv/                  # Menu dạng file CSV (để import data mẫu)
│   ├── prisma/               # Schema và script seed data (seed.ts)
│   ├── src/
│   │   ├── ai/               # Custom Prompts, Tools (Function Calling), xử lý Gemini Flow
│   │   ├── bot/              # File config cho Grammy telegram bot
│   │   ├── config/           # Lấy biến môi trường (Environment vars)
│   │   ├── controllers/      # Routing Controllers cho Express
│   │   ├── routes/           # Các route của Express (API webhook Telegram, PayOS, Dashboard)
│   │   ├── services/         # Repository pattern xử lý DB, Cart (Redis), Order, PayOS
│   │   └── index.ts          # Express Server entry-point
│   └── package.json
├── frontend/                 # Giao diện Kitchen Dashboard phục vụ việc xem đơn
│   ├── src/
│   │   ├── app/
│   │   └── components/
│   └── package.json

```

---

## 🚀 Hướng dẫn cài đặt và chạy (Quick Start)

### Yêu cầu tiên quyết
- Node.js (phiên bản > 20.0).
- Telegram Account (Dùng *BotFather* để tạo Bot mới và lấy Token).
- Cổng kết nối PayOS, cấu hình IPN Webhook.
- Ngrok (để public port localhost ra internet phục vụ việc bắt Webhook của Telegram và PayOS).
- Database PostgreSQL & Redis. (Bạn có thể dùng Neon.tech và upstash như setup hiện tại).

### Bước 1: Setup Backend & Database

1. Clone thư mục dự án và di chuyển vào `backend`:
   ```bash
   cd milk-tea-bot/backend
   npm install
   ```

2. Cài đặt các biến môi trường:
   Tạo file `.env` tại thư mục `backend/` dựa trên tham khảo sau:
   ```env
   # TELEGRAM
   TELEGRAM_BOT_TOKEN="your_bot_token"
   TELEGRAM_WEBHOOK_SECRET="random_string_secret"

   # AI - GEMINI
   GEMINI_API_KEY="your_gemini_api_key"
   GEMINI_MODEL="gemini-3.1-flash-lite-preview"
   
   # PORTS & URL
   PORT=5000
   FRONTEND_URL="http://localhost:3000"
   WEBHOOK_URL="https://your-ngrok-url.ngrok-free.dev" # Đổi lại theo ngrok sinh ra

   # REDIS & DATABASE (POSTGRESQL)
   UPSTASH_REDIS_REST_URL="..."
   UPSTASH_REDIS_REST_TOKEN="..."
   DATABASE_URL="..."

   # PAYOS
   PAYOS_CLIENT_ID="..."
   PAYOS_API_KEY="..."
   PAYOS_CHECKSUM_KEY="..."
   ```

3. Nạp Menu Database (Seed Data):
   ```bash
   # Đồng bộ bảng vào Postgres (nếu cần đổi URL)
   npx prisma db push 
   
   # Chạy kịch bản đọc file csv/Menu.csv nạp vào database
   npm run seed
   ```

4. Khởi động Backend:
   ```bash
   npm run dev
   ```
   > Backend sẽ lắng nghe tại `localhost:5000`.

### Bước 2: Bật Ngrok và trỏ Webhook
Giữ máy chủ backend đang chạy, mở một terminal khác:
```bash
# Public cổng 5000 thành HTTPS
ngrok http 5000
```
Tiếp đến, lấy link ngrok (`https://______.ngrok-free.dev`) dán vào biến `WEBHOOK_URL` ở trong `.env` của backend. 
Gửi 1 cURL Request hoặc dùng Postman gọi vào `POST {{WEBHOOK_URL}}/setup-webhook` để báo cho Server Telegram biết endpoint của bạn.
```bash
Invoke-WebRequest -Method POST -Uri "WEBHOOK_URL/setup-webhook" -Headers @{ "x-admin-key" = "YOUR_ADMIN_KEY" }
```
Cấu hình Webhook PayOS trong cài đặt cua "kenh thanh toán" của PayOS.



### Bước 3: Setup Kitchen Dashboard (Frontend)

1. Mở một terminal mới (split terminal), vào thư mục frontend:
   ```bash
   cd milk-tea-bot/frontend
   npm install
   ```

2. Khởi động Next.js:
   ```bash
   npm run dev
   ```
   > Dashboard bếp sẽ lắng nghe tại `http://localhost:3000`.

---

## 🧪 Cách tiến hành Testing Demo

- **Bot Đặt Món**: Truy cập vào Telegram Bot, nhấn Bắt đầu (`/start`). Chat bằng tiếng việt, hỏi bot "Menu quán có gì", sau đó thêm món "1 ly olong sữa size M thêm trân châu" vào giỏ.
- **Thanh toán**: Yêu cầu chốt đơn. Bot sẽ gửi trả một đường link thanh toán của PayOS. Nhấn vào chuyển sang Web, chuyen khoan thanh cong.
- **Bếp nhận đơn**: Quay sang Browser `http://localhost:3000`, bạn sẽ thấy đơn vừa tạo "POP-UP" xuất hiện trên bảng của bếp với đầy đủ chú thích (Kích cỡ, topping, text tùy ý khách ghi chú thêm dặn dò). Mẹ có thể bắt đầu pha đồ uống!
