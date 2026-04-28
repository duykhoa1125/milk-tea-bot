import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateCartItems, CartItemSelector, CartItem } from './cart.service';

// Mock dependencies
vi.mock('../lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  }
}));

import { redis } from '../lib/redis';

describe('cart.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('updateCartItems', () => {
    it('should correctly update matching items by ID', async () => {
      const mockCart: CartItem[] = [
        { id: '1', productId: 'p1', productName: 'Tea', size: 'M', toppings: [], note: '', quantity: 1 },
        { id: '2', productId: 'p2', productName: 'Coffee', size: 'L', toppings: [], note: '', quantity: 2 }
      ];

      (redis.get as any).mockResolvedValue(mockCart);

      const selector: CartItemSelector = { id: '1' };
      const updates = { quantity: 3, note: 'Extra hot' };

      const result = await updateCartItems('user1', selector, updates);

      expect(result.updatedCount).toBe(1);
      expect(result.cart[0]).toEqual({
        ...mockCart[0],
        quantity: 3,
        note: 'Extra hot'
      });
      expect(result.cart[1]).toEqual(mockCart[1]);

      expect(redis.set).toHaveBeenCalledWith(
        'cart:user1',
        result.cart,
        { ex: 86400 }
      );
    });

    it('should return 0 updatedCount when no items match the selector', async () => {
      const mockCart: CartItem[] = [
        { id: '1', productId: 'p1', productName: 'Tea', size: 'M', toppings: [], note: '', quantity: 1 }
      ];

      (redis.get as any).mockResolvedValue(mockCart);

      const selector: CartItemSelector = { id: 'non-existent' };
      const updates = { quantity: 5 };

      const result = await updateCartItems('user1', selector, updates);

      expect(result.updatedCount).toBe(0);
      expect(result.cart).toEqual(mockCart);
    });

    it('should handle an empty cart', async () => {
      (redis.get as any).mockResolvedValue(null); // Simulated empty cart

      const selector: CartItemSelector = { id: '1' };
      const updates = { quantity: 2 };

      const result = await updateCartItems('user1', selector, updates);

      expect(result.updatedCount).toBe(0);
      expect(result.cart).toEqual([]);
    });

    it('should update multiple items if they match the selector (e.g. by productId)', async () => {
       const mockCart: CartItem[] = [
        { id: '1', productId: 'p1', productName: 'Tea', size: 'M', toppings: [], note: '', quantity: 1 },
        { id: '2', productId: 'p1', productName: 'Tea', size: 'L', toppings: [], note: '', quantity: 2 },
        { id: '3', productId: 'p2', productName: 'Coffee', size: 'M', toppings: [], note: '', quantity: 1 }
      ];

      (redis.get as any).mockResolvedValue(mockCart);

      const selector: CartItemSelector = { productId: 'p1' };
      const updates = { note: 'Please make it sweet' };

      const result = await updateCartItems('user1', selector, updates);

      expect(result.updatedCount).toBe(2);
      expect(result.cart[0].note).toBe('Please make it sweet');
      expect(result.cart[1].note).toBe('Please make it sweet');
      expect(result.cart[2].note).toBe(''); // unchanged
    });

    it('should partial update fields without affecting others', async () => {
      const mockCart: CartItem[] = [
        { id: '1', productId: 'p1', productName: 'Tea', size: 'M', toppings: ['boba'], note: 'hot', quantity: 2 }
      ];

      (redis.get as any).mockResolvedValue(mockCart);

      const selector: CartItemSelector = { id: '1' };
      const updates = { quantity: 1 }; // Only update quantity

      const result = await updateCartItems('user1', selector, updates);

      expect(result.updatedCount).toBe(1);
      expect(result.cart[0]).toEqual({
        ...mockCart[0],
        quantity: 1
      });
    });

    it('should update all items if an empty selector is provided', async () => {
      const mockCart: CartItem[] = [
        { id: '1', productId: 'p1', productName: 'Tea', size: 'M', toppings: [], note: '', quantity: 1 },
        { id: '2', productId: 'p2', productName: 'Coffee', size: 'L', toppings: [], note: '', quantity: 2 }
      ];

      (redis.get as any).mockResolvedValue(mockCart);

      const selector: CartItemSelector = undefined as any; // Simulating no selector or empty logic if the app allows it
      const updates = { quantity: 5 };

      const result = await updateCartItems('user1', selector, updates);

      expect(result.updatedCount).toBe(2);
      expect(result.cart[0].quantity).toBe(5);
      expect(result.cart[1].quantity).toBe(5);
    });

    it('should properly handle falsy update values like 0 for quantity or empty string for note', async () => {
      const mockCart: CartItem[] = [
        { id: '1', productId: 'p1', productName: 'Tea', size: 'M', toppings: [], note: 'hot', quantity: 2 }
      ];

      (redis.get as any).mockResolvedValue(mockCart);

      const selector: CartItemSelector = { id: '1' };
      const updates = { quantity: 0, note: '' }; // Falsy values

      const result = await updateCartItems('user1', selector, updates);

      expect(result.updatedCount).toBe(1);
      expect(result.cart[0].quantity).toBe(0);
      expect(result.cart[0].note).toBe('');
    });

    it('should correctly match items by partial productName (case-insensitive)', async () => {
      const mockCart: CartItem[] = [
        { id: '1', productId: 'p1', productName: 'Green Tea', size: 'M', toppings: [], note: '', quantity: 1 },
        { id: '2', productId: 'p2', productName: 'Black Coffee', size: 'M', toppings: [], note: '', quantity: 1 }
      ];

      (redis.get as any).mockResolvedValue(mockCart);

      const selector: CartItemSelector = { productName: 'tea' }; // lowercase substring
      const updates = { size: 'L' as const };

      const result = await updateCartItems('user1', selector, updates);

      expect(result.updatedCount).toBe(1);
      expect(result.cart[0].size).toBe('L');
      expect(result.cart[1].size).toBe('M');
    });

    it('should correctly match items by size', async () => {
      const mockCart: CartItem[] = [
        { id: '1', productId: 'p1', productName: 'Tea', size: 'M', toppings: [], note: '', quantity: 1 },
        { id: '2', productId: 'p2', productName: 'Coffee', size: 'L', toppings: [], note: '', quantity: 1 }
      ];

      (redis.get as any).mockResolvedValue(mockCart);

      const selector: CartItemSelector = { size: 'L' as const };
      const updates = { quantity: 3 };

      const result = await updateCartItems('user1', selector, updates);

      expect(result.updatedCount).toBe(1);
      expect(result.cart[0].quantity).toBe(1);
      expect(result.cart[1].quantity).toBe(3);
    });

    it('should correctly match items with complex selectors (e.g. productId AND size)', async () => {
      const mockCart: CartItem[] = [
        { id: '1', productId: 'p1', productName: 'Tea', size: 'M', toppings: [], note: '', quantity: 1 },
        { id: '2', productId: 'p1', productName: 'Tea', size: 'L', toppings: [], note: '', quantity: 1 },
        { id: '3', productId: 'p2', productName: 'Coffee', size: 'L', toppings: [], note: '', quantity: 1 }
      ];

      (redis.get as any).mockResolvedValue(mockCart);

      const selector: CartItemSelector = { productId: 'p1', size: 'L' as const };
      const updates = { note: 'Special' };

      const result = await updateCartItems('user1', selector, updates);

      expect(result.updatedCount).toBe(1);
      expect(result.cart[0].note).toBe('');
      expect(result.cart[1].note).toBe('Special');
      expect(result.cart[2].note).toBe('');
    });
  });
});
