# Hướng Dẫn Chi Tiết: Giai Đoạn 3 - Database Core & Quản Lý Đơn Hàng (Tuần 5-7)

Vì bạn vừa bổ sung file `csv/Menu.csv` cực kỳ chi tiết, lộ trình của chúng ta sẽ nâng cấp lên tầng kiến trúc chuyên nghiệp: dữ liệu được quản lý tập trung!

Thay vì lưu text hardcode, ta sẽ thiết kế một cấu trúc Schema chuẩn PostgreSQL. Khi có schema này, bạn có thể dễ dàng quản lý theo `Size`, theo `Platform` (Telegram/Zalo), và lưu giữ được `unitPrice` lúc bán để không bị lệch doanh thu khi giá Menu thay đổi.

---

## Mở Đầu: Database Setup với Prisma

Chúng ta sẽ dùng Prisma kết nối với **PostgreSQL** (chẳng hạn qua dịch vụ Neon.tech).

### 1. Cài đặt Prisma và các packages cần thiết
Trong terminal, chạy các lệnh:
```bash
npm install prisma -D
npm install @prisma/client
npm install csv-parser
```

Khởi tạo cấu trúc Prisma:
```bash
npx prisma init
```
Sửa URL trong file `.env` thành URL của Database PostgreSQL thực tế của bạn:
`DATABASE_URL="postgresql://user:password@xxx.neon.tech/neondb?sslmode=require"`

---

## Bước 1: Khai Báo Prisma Schema Nâng Cao

Mở file `prisma/schema.prisma` và dán cấu trúc dưới đây. Schema này đã được thiết kế mở rộng:
- Tách riêng giá cố định (`priceFixed`) cho Topping.
- Hỗ trợ lưu trữ platform (`externalId`) của khách.
- Lưu trữ giá bán chốt sổ `unitPrice` và List `toppings` kiểu Native JSON bên trong `OrderItem`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ProductType {
  DRINK
  TOPPING
}

enum OrderStatus {
  PENDING
  COOKING
  DONE
  CANCELLED
}

enum Platform {
  TELEGRAM
  ZALO
}

model User {
  id         Int      @id @default(autoincrement())
  externalId String   @unique        // Telegram chat_id hoặc Zalo user_id
  platform   Platform @default(TELEGRAM)
  name       String?
  orders     Order[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Product {
  id          String      @id         // TS01, TOP01...
  category    String
  name        String
  description String?
  priceM      Int?                    // null nếu không có size M (topping chỉ có 1 giá)
  priceL      Int?                    // null nếu không có size L
  priceFixed  Int?                    // Dùng cho Topping (giá cố định không phân size)
  available   Boolean     @default(true)
  type        ProductType @default(DRINK)
  orderItems  OrderItem[]
}

model Order {
  id         Int         @id @default(autoincrement())
  userId     Int
  user       User        @relation(fields: [userId], references: [id])
  totalPrice Int
  status     OrderStatus @default(PENDING)
  note       String?                 // Ghi chú chung của đơn (không phải từng món)
  items      OrderItem[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt  // Tự cập nhật khi status thay đổi
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int
  order     Order   @relation(fields: [orderId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
  size      String? // null nếu là topping
  quantity  Int     @default(1)
  unitPrice Int                      // Giá tại thời điểm đặt (tránh bị ảnh hưởng khi menu đổi giá)
  toppings  Json    @default("[]")   // [{ "id": "TOP01", "name": "...", "price": 5000 }]
  note      String?
}
```

Sau khi save xong, cập nhật thay đổi lên database:
```bash
npx prisma db push
```

---

## Bước 2: Viết Script Seed Dữ Liệu từ File CSV vào Database

Chúng ta tạo file `prisma/seed.ts` để móc dữ liệu từ file `Menu.csv` đã tải nhét vào Database.

```typescript
import { PrismaClient, ProductType } from '@prisma/client';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, '../csv/Menu.csv');
  console.log('Bắt đầu đọc file: ', filePath);

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', async (row) => {
      // Phân loại
      const type = row.category === 'Topping' ? ProductType.TOPPING : ProductType.DRINK;
      const isTopping = type === ProductType.TOPPING;
      
      const pM = parseInt(row.price_m);
      const pL = parseInt(row.price_l);
      
      await prisma.product.upsert({
        where: { id: row.item_id },
        update: {
          priceM: isTopping ? null : (isNaN(pM) ? null : pM),
          priceL: isTopping ? null : (isNaN(pL) ? null : pL),
          priceFixed: isTopping ? (isNaN(pM) ? null : pM) : null,
          available: row.available === 'true',
        },
        create: {
          id: row.item_id,
          category: row.category,
          name: row.name,
          description: row.description || null,
          priceM: isTopping ? null : (isNaN(pM) ? null : pM),
          priceL: isTopping ? null : (isNaN(pL) ? null : pL),
          priceFixed: isTopping ? (isNaN(pM) ? null : pM) : null,
          available: row.available === 'true',
          type: type
        }
      });
    })
    .on('end', () => {
      console.log('Seed dữ liệu CSV thành công!');
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
```
Mở `package.json` và thêm script này nếu cần chạy nhanh: `"seed": "tsx prisma/seed.ts"` sau đó gõ `npm run seed`.

---

## Bước 3: Nâng Cấp Logic "Thanh Toán / Chốt Đơn"

Khi khách muốn chốt đơn, Tool trên AI sẽ được gọi thông qua function sau. Tool này đẩy giỏ hàng từ Upstash Redis vào PostgreSQL.

**1. Định nghĩa Tool (`src/ai/tools.ts`):**
```typescript
export const checkoutCartDeclaration = {
  name: "checkout_cart",
  description: "Gọi khi người dùng nói 'chốt đơn', 'thanh toán', 'tính tiền'.",
  parameters: {
      type: SchemaType.OBJECT,
      properties: {
          note: { type: SchemaType.STRING, description: "Ghi chú chung do khách yêu cầu cho cả đơn lấy nĩa, không lấy biên lai (nếu có)" }
      }
  }
};
```

**2. Viết service Order (`src/services/order.service.ts`):**
```typescript
import { PrismaClient } from '@prisma/client';
import { getCart, clearCart } from './cart.service';

const prisma = new PrismaClient();

export const checkout = async (telegramId: string, authorName: string, overallNote?: string) => {
    // 1. Lấy giỏ hàng từ Redis
    const cart = await getCart(telegramId);
    if (!cart || cart.length === 0) return { error: "Giỏ hàng rỗng" };

    // 2. Tìm hoặc Tạo Khách Hàng (Dựa trên Schema mới với externalId)
    const user = await prisma.user.upsert({
        where: { externalId: telegramId },
        update: { name: authorName },
        create: { externalId: telegramId, name: authorName }
    });

    // 3. (Tùy chọn) Tính tổng tiền dựa trên giá lúc bán `unitPrice`
    let calculatedTotal = 0;
    const orderItemsData = [];
    
    // Lưu ý: Cần loop qua `cart` sau đó lấy DB value `priceM`/`priceL` của Product 
    // để gán chính xác vào `unitPrice`.

    // 4. Lưu Hóa Đơn (Tạo Transaction trên OrderItem, Json Toppings...)
    const order = await prisma.order.create({
        data: {
            userId: user.id,
            totalPrice: 100000, // Thay bằng calculatedTotal
            note: overallNote,
            items: {
                create: cart.map(item => ({
                    productId: item.productId, // Phải đảm bảo giỏ hàng đã lưu ID, ko phải tên chay
                    size: item.size,
                    unitPrice: 40000, // Replace with dynamic price query
                    toppings: item.toppings, // Map to [{id, name, price}] theo Json native structure
                    note: item.note,
                    quantity: item.quantity
                }))
            }
        }
    });

    // 5. Giải phóng session
    await clearCart(telegramId);

    return { success: true, orderId: order.id };
}
```

👉 **Next Step (Giai đoạn 3 Dashboard):** Sử dụng chung `PRISMA_DATABASE` này cho Web-Dashboard của nhà bếp để họ nhìn thấy `status` của hóa đơn được update realtime.
