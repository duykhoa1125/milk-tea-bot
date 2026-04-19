import "dotenv/config";
import { PrismaClient, ProductType } from "@prisma/client";
import pkg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const formatPrice = (price: number | null | undefined) => {
  if (price == null) return null;
  return `${price}k`;
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
    .map(mapProductToLine);
  const toppings = products
    .filter((p) => p.type === ProductType.TOPPING)
    .map(mapProductToLine);

  const lines: string[] = ["Menu hien tai:"];
  lines.push("Do uong:");
  lines.push(...(drinks.length > 0 ? drinks : ["- Chua co du lieu"]));
  lines.push("");
  lines.push("Topping:");
  lines.push(...(toppings.length > 0 ? toppings : ["- Chua co du lieu"]));

  return lines.join("\n");
};
