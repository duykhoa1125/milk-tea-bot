import "dotenv/config";
import { PrismaClient, ProductType } from "@prisma/client";
import pkg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const formatPrice = (price: number | null | undefined) => {
  if (price == null) return null;
  return `${Math.round(price / 1000)}k`;
};

const mapProductToLine = (item: {
  id: string;
  name: string;
  priceM: number | null;
  priceL: number | null;
  priceFixed: number | null;
}) => {
  const sizeM = formatPrice(item.priceM);
  const sizeL = formatPrice(item.priceL);
  const fixed = formatPrice(item.priceFixed);

  if (fixed) {
    return `- ${item.id}: ${item.name} (${fixed})`;
  }

  if (sizeM && sizeL) {
    return `- ${item.id}: ${item.name} (Size M: ${sizeM}, Size L: ${sizeL})`;
  }

  if (sizeM) {
    return `- ${item.id}: ${item.name} (Size M: ${sizeM})`;
  }

  if (sizeL) {
    return `- ${item.id}: ${item.name} (Size L: ${sizeL})`;
  }

  return `- ${item.id}: ${item.name}`;
};

const mapProductToUserLine = (item: {
  name: string;
  priceM: number | null;
  priceL: number | null;
  priceFixed: number | null;
}) => {
  const sizeM = formatPrice(item.priceM);
  const sizeL = formatPrice(item.priceL);
  const fixed = formatPrice(item.priceFixed);

  if (fixed) {
    return `${item.name} (${fixed})`;
  }

  if (sizeM && sizeL) {
    return `${item.name} (${sizeM}/${sizeL})`;
  }

  if (sizeM) {
    return `${item.name} (${sizeM})`;
  }

  if (sizeL) {
    return `${item.name} (${sizeL})`;
  }

  return item.name;
};

const toTwoColumns = (items: string[]) => {
  if (items.length === 0) return ["- Chua co du lieu"];

  const leftWidth = Math.max(
    ...items.filter((_, i) => i % 2 === 0).map((line) => line.length),
    20,
  );

  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = `• ${items[i]}`;
    const right = items[i + 1] ? `• ${items[i + 1]}` : "";
    rows.push(`${left.padEnd(leftWidth + 3)}${right}`.trimEnd());
  }

  return rows;
};

export const getMenuPromptText = async () => {
  const products = await prisma.product.findMany({
    orderBy: [{ type: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      priceM: true,
      priceL: true,
      priceFixed: true,
      available: true,
      type: true,
    },
  });

  const availableDrinks = products
    .filter((p) => p.available && p.type === ProductType.DRINK)
    .map(mapProductToLine);
  const availableToppings = products
    .filter((p) => p.available && p.type === ProductType.TOPPING)
    .map(mapProductToLine);
  const unavailable = products
    .filter((p) => !p.available)
    .map((p) => `- ${p.id}: ${p.name}`);

  const lines: string[] = ["--- MENU HIEN TAI TU DATABASE ---"];

  lines.push("DO UONG:");
  lines.push(
    ...(availableDrinks.length > 0 ? availableDrinks : ["- Chua co du lieu"]),
  );
  lines.push("");

  lines.push("TOPPING:");
  lines.push(
    ...(availableToppings.length > 0
      ? availableToppings
      : ["- Chua co du lieu"]),
  );
  lines.push("");

  lines.push("MON TAM HET:");
  lines.push(...(unavailable.length > 0 ? unavailable : ["- Khong co"]));

  return lines.join("\n");
};

export const getMenuForUserText = async () => {
  const products = await prisma.product.findMany({
    where: { available: true },
    orderBy: [{ type: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      priceM: true,
      priceL: true,
      priceFixed: true,
      type: true,
    },
  });

  const drinks = products
    .filter((p) => p.type === ProductType.DRINK)
    .map(mapProductToUserLine);
  const toppings = products
    .filter((p) => p.type === ProductType.TOPPING)
    .map(mapProductToUserLine);

  const lines: string[] = ["MENU HIEN TAI", ""];
  lines.push("DO UONG (M/L):");
  lines.push(...toTwoColumns(drinks));
  lines.push("");
  lines.push("Topping:");
  lines.push(...toTwoColumns(toppings));

  return lines.join("\n");
};
