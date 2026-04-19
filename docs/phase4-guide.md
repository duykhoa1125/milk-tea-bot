# Hướng Dẫn Chi Tiết: Giai Đoạn 4 - Kitchen Dashboard & Go Live (Tuần 6-10)

> [!IMPORTANT]
> Trước khi bắt đầu Giai đoạn 4, cần hoàn thiện **2 việc còn dang dở từ Giai đoạn 3**. Các phần này là prerequisite bắt buộc.

---

## 🔧 Hoàn Thiện Giai Đoạn 3 (Prerequisite)

### P-1: Đăng ký Tool `checkout_cart` vào Gemini

Hiện tại tool `checkoutCartDeclaration` đã được khai báo trong `tools.ts` nhưng **chưa được truyền vào model**. AI không biết tool này tồn tại.

Sửa file `src/ai/gemini.ts`, cập nhật phần import và `tools[]`:

```typescript
// src/ai/gemini.ts
import { addToCartDeclaration, viewCartDeclaration, checkoutCartDeclaration } from "./tools";
import { addToCart, getCart } from "../services/cart.service";
import { checkout } from "../services/order.service"; // THÊM IMPORT NÀY

// Cập nhật tools trong getGenerativeModel:
tools: [
    {
        functionDeclarations: [
            addToCartDeclaration,
            viewCartDeclaration,
            checkoutCartDeclaration // THÊM VÀO ĐÂY
        ]
    }
]
```

Sau đó, trong vòng lặp function calling, thêm case xử lý `checkout_cart`:

```typescript
// Thêm vào trong while loop của handleAIFlow
else if (funcName === 'checkout_cart') {
    const authorName = ''; // Cần truyền từ ctx Telegram xuống — xem P-2
    const result = await checkout(
        String(userId),
        authorName,
        args.note
    );
    functionResult = result.error
        ? { status: "error", message: result.error }
        : { status: "success", orderId: result.orderId, message: "Đơn hàng đã được chốt thành công!" };
}
```

> [!NOTE]
> `handleAIFlow` hiện chỉ nhận `userId` (number). Bạn cần truyền thêm `userName` string từ bot instance xuống. Sửa signature: `handleAIFlow(userId: number, userName: string, userPrompt: string)` và cập nhật `bot/instance.ts` truyền `ctx.from.first_name`.

### P-2: Tính Giá Động trong `order.service.ts`

Hiện tại `unitPrice` đang hardcode `40000`. Cần query DB để lấy giá thực tế theo size M/L.

Thay thế phần tạo order trong `src/services/order.service.ts`:

```typescript
// src/services/order.service.ts
import pkg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const checkout = async (telegramId: string, authorName: string, overallNote?: string) => {
    const cart = await getCart(telegramId);
    if (!cart || cart.length === 0) return { error: "Giỏ hàng rỗng" };

    const user = await prisma.user.upsert({
        where: { externalId: telegramId },
        update: { name: authorName },
        create: { externalId: telegramId, name: authorName }
    });

    // Tính giá động: lấy thông tin Product từ DB
    let calculatedTotal = 0;
    const itemsWithPrice = await Promise.all(cart.map(async (item) => {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        const unitPrice = item.size === 'L'
            ? (product?.priceL ?? product?.priceFixed ?? 0)
            : (product?.priceM ?? product?.priceFixed ?? 0);
        calculatedTotal += unitPrice * item.quantity;
        return {
            productId: item.productId,
            size: item.size,
            unitPrice,
            quantity: item.quantity,
            toppings: item.toppings, // [{id, name, price}] — sẽ cần chuẩn hóa sau
            note: item.note,
        };
    }));

    const order = await prisma.order.create({
        data: {
            userId: user.id,
            totalPrice: calculatedTotal,
            note: overallNote,
            items: { create: itemsWithPrice }
        }
    });

    await clearCart(telegramId);
    return { success: true, orderId: order.id, totalPrice: calculatedTotal };
}
```

---

## 📊 Giai Đoạn 4A: Kitchen Dashboard (Tuần 6-7)

**Mục tiêu:** Nhân viên quán có giao diện web để theo dõi và cập nhật trạng thái đơn hàng realtime.

### Tuần 6: Khởi tạo Next.js Dashboard

Dashboard sẽ nằm trong một thư mục **riêng biệt** trong project, dùng chung PostgreSQL database.

```bash
# Tạo thư mục dashboard trong project
npx -y create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd dashboard
npm install @prisma/client @prisma/adapter-pg pg
```

Cấu hình để `dashboard` dùng cùng `prisma/schema.prisma` của project gốc:

```bash
# Trong thư mục dashboard, tạo symlink hoặc copy schema
# Cách đơn giản nhất: copy file schema.prisma vào dashboard/prisma/
# và đảm bảo DATABASE_URL trong dashboard/.env trỏ cùng DB
```

### Cấu trúc Dashboard

```text
dashboard/
├── app/
│   ├── page.tsx         # Trang chính: Danh sách đơn PENDING
│   ├── layout.tsx
│   └── api/
│       └── orders/
│           └── route.ts # API route: GET danh sách đơn, PATCH đổi status
├── components/
│   ├── OrderCard.tsx    # Component mỗi ticket đơn hàng
│   └── KanbanBoard.tsx  # Board 3 cột: PENDING | COOKING | DONE
└── prisma/
    └── schema.prisma    # Copy từ project gốc
```

### Tuần 6 - Code cốt lõi:

**`dashboard/app/api/orders/route.ts` (API lấy danh sách đơn):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import pkg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// GET: Lấy tất cả đơn đang chạy
export async function GET() {
    const orders = await prisma.order.findMany({
        where: { status: { in: ['PENDING', 'COOKING'] } },
        include: {
            user: { select: { name: true, externalId: true } },
            items: { include: { product: { select: { name: true } } } }
        },
        orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(orders);
}

// PATCH: Cập nhật trạng thái đơn
export async function PATCH(req: NextRequest) {
    const { orderId, status } = await req.json();
    const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status }
    });
    return NextResponse.json(updated);
}
```

**`dashboard/components/OrderCard.tsx`:**
```typescript
'use client';
import { useState } from 'react';

interface OrderCardProps {
  order: any;
  onStatusChange: (orderId: number, status: string) => void;
}

export default function OrderCard({ order, onStatusChange }: OrderCardProps) {
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
            onClick={() => onStatusChange(order.id, 'COOKING')}
            className="flex-1 bg-yellow-400 text-white rounded-lg py-1 text-sm font-semibold"
          >
            Bắt đầu pha
          </button>
        )}
        {order.status === 'COOKING' && (
          <button
            onClick={() => onStatusChange(order.id, 'DONE')}
            className="flex-1 bg-green-500 text-white rounded-lg py-1 text-sm font-semibold"
          >
            ✅ Xong rồi!
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## 🔔 Giai Đoạn 4B: Realtime & Thông Báo Khách (Tuần 7)

**Mục tiêu:** Dashboard tự cập nhật khi có đơn mới. Khi xong đơn, Telegram bot tự nhắn khách.

### Realtime Polling đơn giản (Không cần WebSocket)

Trong `dashboard/app/page.tsx`, dùng `setInterval` để tự fetch lại mỗi 5 giây:

```typescript
'use client';
import { useEffect, useState } from 'react';
import OrderCard from '@/components/OrderCard';

export default function KitchenPage() {
  const [orders, setOrders] = useState<any[]>([]);

  const fetchOrders = async () => {
    const res = await fetch('/api/orders');
    const data = await res.json();
    setOrders(data);
  };

  const handleStatusChange = async (orderId: number, status: string) => {
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status })
    });

    // Nếu status là DONE -> Gọi API webhook để bot nhắn khách
    if (status === 'DONE') {
      await fetch(`/api/notify?orderId=${orderId}`);
    }

    fetchOrders(); // Refresh lại UI
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
      <h1 className="text-2xl font-bold mb-6">🧋 Kitchen Dashboard</h1>
      <div className="grid grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-semibold mb-3 text-red-500">🔴 Chờ pha ({pending.length})</h2>
          <div className="space-y-3">
            {pending.map(o => <OrderCard key={o.id} order={o} onStatusChange={handleStatusChange} />)}
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-3 text-yellow-500">🟡 Đang làm ({cooking.length})</h2>
          <div className="space-y-3">
            {cooking.map(o => <OrderCard key={o.id} order={o} onStatusChange={handleStatusChange} />)}
          </div>
        </section>
      </div>
    </main>
  );
}
```

### Thông báo khách qua Telegram khi đơn xong

Tạo `dashboard/app/api/notify/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ /* adapter */ });

export async function GET(req: NextRequest) {
    const orderId = Number(req.nextUrl.searchParams.get('orderId'));
    
    // Lấy thông tin đơn + user
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true }
    });

    if (!order || !order.user) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Gửi tin nhắn Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = order.user.externalId;
    const message = `✅ Đơn hàng #${orderId} của bạn đã sẵn sàng! Mời bạn đến lấy đồ nhé ☕`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message })
    });

    return NextResponse.json({ success: true });
}
```

---

## 🚀 Giai Đoạn 4C: Deploy & Go Live (Tuần 8-10)

### Deploy Bot Server (Express)
1. Push code lên GitHub.
2. Tạo project mới trên **Railway** → Connect GitHub → Set environment variables từ `.env` → Deploy.
3. Sau khi Railway cấp URL, cập nhật `WEBHOOK_URL` và gọi `/setup-webhook` một lần.

### Deploy Dashboard (Next.js)
1. Tạo project mới trên **Vercel** → Connect thư mục `dashboard/` trong repo.
2. Set biến `DATABASE_URL` và `TELEGRAM_BOT_TOKEN` trong Vercel Environment Variables.
3. Deploy.

### Checklist Go Live
- [ ] Prisma DB Push lên Neon production
- [ ] Chạy seed script một lần cuối: `npm run seed`
- [ ] Test toàn bộ luồng: Chat → Thêm giỏ → Chốt đơn → Dashboard hiện đơn → Bấm Xong → Telegram báo khách
- [ ] Đảm bảo `npm run dev` của Bot Server đang chạy liên tục (Railway giữ process)

---

> **Lưu ý:** Vì chat history đang lưu trong RAM (`chatSessions` Map), mỗi khi Bot Server restart thì lịch sử chat của tất cả user sẽ bị reset. Nếu muốn giữ nguyên lịch sử, bạn cần serialize history vào Redis — đây là task tối ưu có thể làm sau khi Go Live.
