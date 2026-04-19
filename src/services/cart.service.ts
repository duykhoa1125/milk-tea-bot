import { Redis } from '@upstash/redis'
import { config } from '../config/env';

const redis = new Redis({
    url: config.UPSTASH_REDIS_REST_URL,
    token: config.UPSTASH_REDIS_REST_TOKEN,
})

export interface CartItem {
    id: string;
    productId: string; 
    productName: string;
    size: 'M' | 'L';
    toppings: string[];
    note: string;
    quantity: number;
}

export const getCart = async (userId: string | number): Promise<CartItem[]> => {
    const cartItem = await redis.get<CartItem[]>(`cart:${userId}`);
    return cartItem || [];
};

export const addToCart = async (userId: string | number, item: Omit<CartItem, 'id'>) => {
    const currentCart = await getCart(userId);
    const newItem: CartItem = {
        ...item,
        id: Date.now().toString() // fix in future, 
    };
    currentCart.push(newItem);

    // Lưu lại vào redis (TTL = 1 ngày, nếu khách không chốt sẽ tự xóa)
    await redis.set(`cart:${userId}`, currentCart, { ex: 86400 });
    return currentCart;
};
//sau khi thanh toan
export const clearCart = async (userId: string | number) => {
    await redis.del(`cart:${userId}`);
};