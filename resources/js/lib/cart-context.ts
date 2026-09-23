import { createContext, use } from 'react';
import type { Cart } from '@/lib/cart';

export type CartContextValue = {
    cart: Cart;
    count: number;
    add: (itemId: number, sizeId: number) => void;
    setQuantity: (sizeId: number, quantity: number) => void;
    setNote: (sizeId: number, note: string) => void;
    remove: (sizeId: number) => void;
    setTable: (table: number | null) => void;
    clear: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

/** The order the guest is building. Only usable inside <CartProvider>. */
export function useCart(): CartContextValue {
    const value = use(CartContext);

    if (value === null) {
        throw new Error('useCart must be used inside a CartProvider.');
    }

    return value;
}
