import { beforeEach, describe, expect, it } from 'vite-plus/test';
import {
    addLine,
    CART_MAX_AGE_MS,
    cartCount,
    emptyCart,
    MAX_QUANTITY,
    priceCart,
    readCart,
    removeLine,
    setNote,
    setQuantity,
    setTable,
    writeCart,
} from '@/lib/cart';
import type { MenuCategory } from '@/types';

function fakeStorage() {
    const store = new Map<string, string>();

    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => void store.set(key, value),
            removeItem: (key: string) => void store.delete(key),
        } as unknown as Storage,
    });
}

const menu: MenuCategory[] = [
    {
        id: 1,
        name: 'Meals',
        slug: 'meals',
        description: null,
        sort_order: 0,
        archived_at: null,
        items: [
            {
                id: 10,
                category_id: 1,
                name: 'Adobo',
                description: null,
                image: null,
                is_available: true,
                is_featured: false,
                sort_order: 0,
                archived_at: null,
                sizes: [
                    { id: 100, name: 'Regular', price: 18000 },
                    { id: 101, name: 'Large', price: 24000 },
                ],
            },
            {
                id: 11,
                category_id: 1,
                name: 'Kare-Kare',
                description: null,
                image: null,
                is_available: false,
                is_featured: false,
                sort_order: 1,
                archived_at: null,
                sizes: [{ id: 110, name: 'Regular', price: 26000 }],
            },
        ],
    },
];

beforeEach(fakeStorage);

describe('cart maths', () => {
    it('adds a size once and then counts up', () => {
        const cart = addLine(addLine(emptyCart, 10, 100), 10, 100);

        expect(cart.lines).toHaveLength(1);
        expect(cart.lines[0].quantity).toBe(2);
        expect(cartCount(cart)).toBe(2);
    });

    it('keeps sizes of the same dish apart', () => {
        const cart = addLine(addLine(emptyCart, 10, 100), 10, 101);

        expect(cart.lines).toHaveLength(2);
    });

    it('never goes past the quantity cap', () => {
        const cart = setQuantity(addLine(emptyCart, 10, 100), 100, 999);

        expect(cart.lines[0].quantity).toBe(MAX_QUANTITY);
    });

    it('drops a line at zero and on remove', () => {
        const cart = addLine(emptyCart, 10, 100);

        expect(setQuantity(cart, 100, 0).lines).toHaveLength(0);
        expect(removeLine(cart, 100).lines).toHaveLength(0);
    });

    it('trims a note to the length the kitchen can read', () => {
        const cart = setNote(addLine(emptyCart, 10, 100), 100, 'x'.repeat(200));

        expect(cart.lines[0].note).toHaveLength(120);
    });

    it('takes a table number only when the restaurant has one', () => {
        expect(setTable(emptyCart, 7).table).toBe(7);
        expect(setTable(emptyCart, 0).table).toBeNull();
        expect(setTable(emptyCart, 1000).table).toBeNull();
        expect(setTable(emptyCart, Number.NaN).table).toBeNull();
    });
});

describe('priceCart', () => {
    it('prices lines from the live menu and leaves sold-out dishes out of the total', () => {
        let cart = addLine(emptyCart, 10, 100);
        cart = setQuantity(cart, 100, 2);
        cart = addLine(cart, 11, 110);

        const priced = priceCart(cart, menu);

        expect(priced.lines).toHaveLength(2);
        expect(priced.subtotal).toBe(36000);
        expect(priced.soldOut).toBe(1);
        expect(priced.lines[0].lineTotal).toBe(36000);
        expect(priced.lines[0].item.name).toBe('Adobo');
        expect(priced.lines[0].size.name).toBe('Regular');
    });

    it('forgets lines that left the menu', () => {
        const cart = addLine(emptyCart, 99, 999);

        const priced = priceCart(cart, menu);

        expect(priced.lines).toHaveLength(0);
        expect(priced.dropped).toBe(1);
        expect(priced.subtotal).toBe(0);
    });
});

describe('storage', () => {
    it('reads back what it wrote', () => {
        const cart = setTable(addLine(emptyCart, 10, 100), 7);

        writeCart(cart);

        expect(readCart()).toEqual(cart);
    });

    it('forgets a cart from yesterday', () => {
        writeCart(addLine(emptyCart, 10, 100), 1_000_000);

        expect(readCart(1_000_000 + CART_MAX_AGE_MS + 1)).toEqual(emptyCart);
    });

    it('survives nonsense in storage', () => {
        globalThis.localStorage.setItem('bb.cart', '{not json');

        expect(readCart()).toEqual(emptyCart);
    });
});
