# Hướng Dẫn Chi Tiết: Giai Đoạn 4 - Kitchen Dashboard & Go Live (Tuần 6-10)

> [!NOTE]
> **Prerequisite đã hoàn thành!**
> - ✅ `checkout_cart` tool đã được đăng ký vào Gemini model.
> - ✅ `unitPrice` đã được tính động từ DB thông qua `priceM`/`priceL`/`priceFixed`.

> [!NOTE]
> **Cấu trúc dự án đã thay đổi!** Project đã được tổ chức lại thành monorepo:
> - Backend (Bot + Express + API): `backend/`
> - Frontend (Kitchen Dashboard — UI only): `frontend/`

---

## Kiến Trúc Giai Đoạn 4

```
Frontend (Next.js)          Backend (Express)           Database
     │                            │                         │
     │ fetch /api/orders ─────────►│                         │
     │                            │─── prisma.findMany() ───►│
     │◄─────────────── JSON ──────│◄── orders ──────────────│
     │                            │                         │
     │ fetch /api/orders/1/status ►│                         │
     │                            │─── prisma.update() ─────►│
     │                            │─── sendTelegramMsg() ───►│ (Telegram API)
     │◄─────────────── OK ────────│                         │
```

> [!IMPORTANT]
> **Frontend KHÔNG kết nối trực tiếp vào Database.** Mọi thao tác dữ liệu đều đi qua Backend API. Frontend chỉ cần biết URL của Backend.

---

## 📊 Giai Đoạn 4A: Thêm Dashboard API vào Backend (Tuần 6)

### Bước 1: Thêm CORS middleware vào Backend

Frontend chạy ở port khác, cần cho phép Cross-Origin requests.

```bash
cd backend
npm install cors @types/cors
```

Cập nhật `backend/src/index.ts`:

```typescript
import cors from 'cors';

// Thêm BEFORE các route khác
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    methods: ['GET', 'PATCH', 'POST'],
}));
```

Thêm `FRONTEND_URL=http://localhost:3001` vào `backend/.env`.

### Bước 2: Tạo Dashboard Router trong Backend

Tạo file `backend/src/routes/dashboard.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import pkg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const router = Router();
const { Pool } = pkg;
const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }))
});

// GET /api/orders — Lấy đơn PENDING và COOKING
router.get('/orders', async (req: Request, res: Response) => {
    const orders = await prisma.order.findMany({
        where: { status: { in: ['PENDING', 'COOKING'] } },
        include: {
            user: { select: { name: true, externalId: true } },
            items: { include: { product: { select: { name: true } } } }
        },
        orderBy: { createdAt: 'asc' }
    });
    res.json(orders);
});

// PATCH /api/orders/:id/status — Đổi trạng thái đơn
router.patch('/orders/:id/status', async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status },
        include: { user: true }
    });

    // Nếu DONE -> tự động gửi Telegram thông báo khách
    if (status === 'DONE' && updated.user) {
        const chatId = updated.user.externalId;
        const message = `✅ Đơn hàng #${orderId} của bạn đã sẵn sàng! Mời bạn đến lấy đồ nhé ☕`;
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message })
        });
    }

    res.json(updated);
});

export default router;
```

### Bước 3: Đăng ký Router vào Express App

Cập nhật `backend/src/index.ts`, thêm sau phần setup webhook:

```typescript
import dashboardRouter from './routes/dashboard';

// Dashboard API — dành cho Kitchen Frontend
app.use('/api', dashboardRouter);
```

### Kiểm tra API

Khởi động backend và test thử:

```bash
# Lấy danh sách đơn
curl http://localhost:3000/api/orders

# Đổi trạng thái đơn
curl -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "COOKING"}'
```

---

## 📊 Giai Đoạn 4B: Xây Dựng Kitchen Dashboard UI (Tuần 6-7)

Frontend **không cần Prisma, không cần DATABASE_URL**. Chỉ cần biết URL của Backend.

### Cấu trúc Frontend

```text
frontend/
├── app/
│   ├── page.tsx                # Kitchen Dashboard (UI chính)
│   └── layout.tsx
└── components/
    └── OrderCard.tsx           # Component mỗi ticket đơn hàng
```

### Setup biến môi trường Frontend

Tạo file `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

> [!NOTE]
> Prefix `NEXT_PUBLIC_` là bắt buộc để Next.js expose biến này ra phía client (browser). Không cần `DATABASE_URL` hay `TELEGRAM_BOT_TOKEN` ở frontend.

### Code Frontend

**`frontend/components/OrderCard.tsx`:**
```tsx
'use client';

interface OrderCardProps {
  order: any;
  backendUrl: string;
  onStatusChange: () => void;
}

export default function OrderCard({ order, backendUrl, onStatusChange }: OrderCardProps) {
  const updateStatus = async (status: string) => {
    await fetch(`${backendUrl}/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    onStatusChange(); // Trigger refresh
  };

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <span className="font-bold text-lg">#{order.id}</span>
        <span className="text-sm text-gray-500">{order.user?.name || 'Khách vãng lai'}</span>
      </div>
      <ul className="space-y-1 mb-3">
        {order.items.map((item: any) => (
          <li key={item.id} className="text-sm">
            {item.quantity}x <strong>{item.product.name}</strong> ({item.size})
            {item.note && <span className="text-orange-500 ml-1">⚡ {item.note}</span>}
          </li>
        ))}
      </ul>
      {order.note && (
        <p className="text-xs text-gray-400 italic mb-3">Ghi chú: {order.note}</p>
      )}
      <div className="flex gap-2">
        {order.status === 'PENDING' && (
          <button
            onClick={() => updateStatus('COOKING')}
            className="flex-1 bg-yellow-400 text-white rounded-lg py-2 text-sm font-semibold"
          >
            🔥 Bắt đầu pha
          </button>
        )}
        {order.status === 'COOKING' && (
          <button
            onClick={() => updateStatus('DONE')}
            className="flex-1 bg-green-500 text-white rounded-lg py-2 text-sm font-semibold"
          >
            ✅ Xong rồi!
          </button>
        )}
      </div>
    </div>
  );
}
```

**`frontend/app/page.tsx`:**
```tsx
'use client';
import { useEffect, useState } from 'react';
import OrderCard from '@/components/OrderCard';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export default function KitchenPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchOrders = async () => {
    const res = await fetch(`${BACKEND_URL}/api/orders`);
    const data = await res.json();
    setOrders(data);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); // Polling mỗi 5 giây
    return () => clearInterval(interval);
  }, []);

  const pending = orders.filter(o => o.status === 'PENDING');
  const cooking = orders.filter(o => o.status === 'COOKING');

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">🧋 Kitchen Dashboard</h1>
        <span className="text-xs text-gray-400">
          Cập nhật lúc: {lastUpdate.toLocaleTimeString('vi-VN')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-semibold mb-3 text-red-500">
            🔴 Chờ pha ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map(o => (
              <OrderCard key={o.id} order={o} backendUrl={BACKEND_URL} onStatusChange={fetchOrders} />
            ))}
            {pending.length === 0 && <p className="text-sm text-gray-400 italic">Chưa có đơn mới</p>}
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-3 text-yellow-500">
            🟡 Đang làm ({cooking.length})
          </h2>
          <div className="space-y-3">
            {cooking.map(o => (
              <OrderCard key={o.id} order={o} backendUrl={BACKEND_URL} onStatusChange={fetchOrders} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
```

### Chạy thử local

```bash
# Terminal 1: Backend (port 3000)
npm run backend:dev

# Terminal 2: Frontend (port 3001)
npm run frontend:dev
```

Mở trình duyệt tại `http://localhost:3001` và kiểm tra đơn hàng từ Database hiển thị đúng.

---

## 🚀 Giai Đoạn 4C: Deploy & Go Live (Tuần 8-10)

### Deploy Backend → Railway
1. Push code lên GitHub.
2. Tạo project mới trên **Railway** → Connect GitHub.
3. Cấu hình **Root Directory = `backend`**.
4. Set Environment Variables (copy từ `backend/.env`), thêm:
   - `FRONTEND_URL=https://your-dashboard.vercel.app`
5. Sau khi Railway cấp URL (ví dụ: `https://milk-tea-bot.railway.app`), cập nhật `WEBHOOK_URL` và restart.

### Deploy Frontend → Vercel
1. Vào [vercel.com](https://vercel.com) → **New Project** → Import GitHub repo.
2. Cấu hình **Root Directory = `frontend`**.
3. Set Environment Variables:
   - `NEXT_PUBLIC_BACKEND_URL=https://milk-tea-bot.railway.app`
4. Deploy.

> [!IMPORTANT]
> Sau khi deploy cả 2, bạn cần cập nhật lại `FRONTEND_URL` trong Railway environment với URL Vercel thực tế để CORS hoạt động đúng, rồi restart Backend.

### Checklist Go Live
- [ ] `cd backend && npx prisma db push` (push schema lên production DB)
- [ ] `npm run backend:seed` (từ thư mục root)
- [ ] Cập nhật `FRONTEND_URL` trong Railway = URL Vercel
- [ ] Cập nhật `NEXT_PUBLIC_BACKEND_URL` trong Vercel = URL Railway
- [ ] Test toàn bộ luồng: Chat bot → Thêm giỏ → Chốt đơn → Dashboard hiện đơn → Bấm Xong → Telegram báo khách

---

> **Lưu ý kỹ thuật:** Chat history đang lưu trong RAM (`chatSessions` Map). Mỗi khi Bot Server restart thì lịch sử chat sẽ bị reset. Đây là hành vi chấp nhận được cho MVP. Cải thiện bằng cách serialize history vào Redis — task V2 sau Go Live.
