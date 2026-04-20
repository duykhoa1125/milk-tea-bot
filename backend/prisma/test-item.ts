import 'dotenv/config';
import { PrismaClient, ProductType } from '@prisma/client';
import pkg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const action = process.argv[2];

  if (action === 'create') {
    await prisma.product.upsert({
      where: { id: 'TEST2K' },
      update: {
        priceFixed: 2000,
        available: true,
      },
      create: {
        id: 'TEST2K',
        category: 'Test',
        name: 'Món Test 2k',
        priceFixed: 2000,
        type: ProductType.DRINK,
        available: true,
      },
    });
    console.log('✅ Đã tạo/cập nhật món TEST2K với giá 2000đ');
  } else if (action === 'delete') {
    try {
      await prisma.product.delete({
        where: { id: 'TEST2K' },
      });
      console.log('✅ Đã xóa món TEST2K');
    } catch (e) {
      console.log('❌ Không tìm thấy món TEST2K để xóa');
    }
  } else {
    console.log('Sử dụng: npx tsx prisma/test-item.ts [create|delete]');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
