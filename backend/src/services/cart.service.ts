import { redis } from "../lib/redis";
import { randomUUID } from "node:crypto";

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  size: "M" | "L";
  toppings: string[];
  note: string;
  quantity: number;
}

export interface CartItemSelector {
  id?: string;
  productId?: string;
  productName?: string;
  size?: "M" | "L";
}

const CART_TTL_SECONDS = 86400;
const CART_ORDER_NOTE_TTL_SECONDS = 86400;

const normalizeText = (value: string) => value.trim().toLowerCase();

const matchesSelector = (item: CartItem, selector?: CartItemSelector) => {
  if (!selector) return true;

  if (selector.id && item.id !== selector.id) {
    return false;
  }

  if (selector.productId && item.productId !== selector.productId) {
    return false;
  }

  if (
    selector.productName &&
    !normalizeText(item.productName).includes(
      normalizeText(selector.productName),
    )
  ) {
    return false;
  }

  if (selector.size && item.size !== selector.size) {
    return false;
  }

  return true;
};

const saveCart = async (userId: string | number, cart: CartItem[]) => {
  await redis.set(`cart:${userId}`, cart, { ex: CART_TTL_SECONDS });
};

const getOrderNoteKey = (userId: string | number) => `cart:note:${userId}`;

const saveOrderNote = async (userId: string | number, note: string) => {
  await redis.set(getOrderNoteKey(userId), note, {
    ex: CART_ORDER_NOTE_TTL_SECONDS,
  });
};

export const getCart = async (userId: string | number): Promise<CartItem[]> => {
  const cartItem = await redis.get<CartItem[]>(`cart:${userId}`);
  return cartItem || [];
};

export const addToCart = async (
  userId: string | number,
  item: Omit<CartItem, "id">,
) => {
  const currentCart = await getCart(userId);
  const newItem: CartItem = {
    ...item,
    id: randomUUID(),
  };
  currentCart.push(newItem);

  // Luu lai vao redis (TTL = 1 ngay, neu khach khong chot se tu xoa)
  await saveCart(userId, currentCart);
  return currentCart;
};

export const removeCartItems = async (
  userId: string | number,
  selector?: CartItemSelector,
) => {
  const currentCart = await getCart(userId);
  const remainingCart = currentCart.filter(
    (item) => !matchesSelector(item, selector),
  );
  const removedCount = currentCart.length - remainingCart.length;

  await saveCart(userId, remainingCart);

  return {
    removedCount,
    cart: remainingCart,
  };
};

export const keepOnlyCartItems = async (
  userId: string | number,
  selectors: CartItemSelector[],
) => {
  const currentCart = await getCart(userId);

  if (selectors.length === 0) {
    await saveCart(userId, []);
    return {
      keptCount: 0,
      removedCount: currentCart.length,
      cart: [] as CartItem[],
    };
  }

  const keptCart = currentCart.filter((item) =>
    selectors.some((selector) => matchesSelector(item, selector)),
  );

  await saveCart(userId, keptCart);

  return {
    keptCount: keptCart.length,
    removedCount: currentCart.length - keptCart.length,
    cart: keptCart,
  };
};

export const updateCartItems = async (
  userId: string | number,
  selector: CartItemSelector,
  updates: {
    note?: string;
    toppings?: string[];
    quantity?: number;
    size?: "M" | "L";
  },
) => {
  const currentCart = await getCart(userId);
  let updatedCount = 0;

  const updatedCart = currentCart.map((item) => {
    if (!matchesSelector(item, selector)) {
      return item;
    }

    updatedCount += 1;

    return {
      ...item,
      note: updates.note ?? item.note,
      toppings: updates.toppings ?? item.toppings,
      quantity: updates.quantity ?? item.quantity,
      size: updates.size ?? item.size,
    };
  });

  await saveCart(userId, updatedCart);

  return {
    updatedCount,
    cart: updatedCart,
  };
};

// sau khi thanh toan
export const clearCart = async (userId: string | number) => {
  await redis.del(`cart:${userId}`);
  await redis.del(getOrderNoteKey(userId));
};

export const getCartOrderNote = async (
  userId: string | number,
): Promise<string> => {
  const note = await redis.get<string>(getOrderNoteKey(userId));
  return note || "";
};

export const setCartOrderNote = async (
  userId: string | number,
  note: string,
) => {
  const normalizedNote = note.trim();

  if (!normalizedNote) {
    await redis.del(getOrderNoteKey(userId));
    return "";
  }

  await saveOrderNote(userId, normalizedNote);
  return normalizedNote;
};
