import { PrismaClient } from "@prisma/client";
import pkg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});
