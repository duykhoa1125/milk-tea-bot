import { redis } from "../lib/redis";

export interface CartItem {
    id: string;
    productId: string;
    productName: string;
    size: "M" | "L";
    toppings: string[];
    note: string;
    quantity: number;
}

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
        id: Date.now().toString(),
    };
    currentCart.push(newItem);

    // Luu lai vao redis (TTL = 1 ngay, neu khach khong chot se tu xoa)
    await redis.set(`cart:${userId}`, currentCart, { ex: 86400 });
    return currentCart;
};
// sau khi thanh toan
export const clearCart = async (userId: string | number) => {
    await redis.del(`cart:${userId}`);
};
