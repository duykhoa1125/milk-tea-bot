import 'dotenv/config';
import { PrismaClient, ProductType } from '@prisma/client';
import fs from 'node:fs';
import csv from 'csv-parser';
import path from 'node:path';
import pkg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const filePath = path.join(process.cwd(), 'csv', 'Menu.csv');
  console.log('Bắt đầu đọc file: ', filePath);

  const results: any[] = [];

  // Đọc toàn bộ dữ liệu từ CSV vào RAM trước (vì file nhỏ)
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(true))
      .on('error', (err) => reject(err));
  });

  // Sử dụng vòng lặp for..of để đảm bảo await từng Upsert
  for (const row of results) {
    const type = row.category === 'Topping' ? ProductType.TOPPING : ProductType.DRINK;
    const isTopping = type === ProductType.TOPPING;
    
    // Parse giá an toàn
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
  }

  console.log('Seed dữ liệu CSV thành công!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
