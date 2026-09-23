import type { MenuCategory, MenuItem, MenuItemSize } from '@/types';

export type CartLine = {
    itemId: number;
    sizeId: number;
    quantity: number;
    note: string;
};

export type Cart = {
    lines: CartLine[];
    table: number | null;
};

export type PricedLine = {
    line: CartLine;
    item: MenuItem;
    size: MenuItemSize;
    lineTotal: number;
};

export type PricedCart = {
    lines: PricedLine[];
    subtotal: number;
    soldOut: number;
    dropped: number;
};

export const CART_KEY = 'bb.cart';
export const MAX_LINES = 30;
export const MAX_QUANTITY = 20;
export const MAX_NOTE = 120;
export const MAX_TABLE = 99;
export const CART_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const VERSION = 1;

export const emptyCart: Cart = { lines: [], table: null };

/** Add one of a size, or raise its quantity when it is already in the order. */
export function addLine(cart: Cart, itemId: number, sizeId: number): Cart {
    const existing = cart.lines.find((line) => line.sizeId === sizeId);

    if (existing) {
        return setQuantity(cart, sizeId, existing.quantity + 1);
    }

    if (cart.lines.length >= MAX_LINES) {
        return cart;
    }

    return {
        ...cart,
        lines: [...cart.lines, { itemId, sizeId, quantity: 1, note: '' }],
    };
}

/** Set a line's quantity. Zero removes the line, and the cap is the kitchen's. */
export function setQuantity(
    cart: Cart,
    sizeId: number,
    quantity: number,
): Cart {
    if (quantity < 1) {
        return removeLine(cart, sizeId);
    }

    return {
        ...cart,
        lines: cart.lines.map((line) =>
            line.sizeId === sizeId
                ? { ...line, quantity: Math.min(quantity, MAX_QUANTITY) }
                : line,
        ),
    };
}

/** Keep a short bilin for the kitchen against a line. */
export function setNote(cart: Cart, sizeId: number, note: string): Cart {
    return {
        ...cart,
        lines: cart.lines.map((line) =>
            line.sizeId === sizeId
                ? { ...line, note: note.slice(0, MAX_NOTE) }
                : line,
        ),
    };
}

export function removeLine(cart: Cart, sizeId: number): Cart {
    return {
        ...cart,
        lines: cart.lines.filter((line) => line.sizeId !== sizeId),
    };
}

/** Remember the table from the QR code, ignoring anything that is not one. */
export function setTable(cart: Cart, table: number | null): Cart {
    const valid =
        table !== null &&
        Number.isInteger(table) &&
        table >= 1 &&
        table <= MAX_TABLE;

    return { ...cart, table: valid ? table : null };
}

export function cartCount(cart: Cart): number {
    return cart.lines.reduce((total, line) => total + line.quantity, 0);
}

/**
 * Join the stored lines with the live menu. Prices always come from the menu
 * that was just loaded, never from storage, and the server prices it again
 * when the order is placed.
 */
export function priceCart(cart: Cart, categories: MenuCategory[]): PricedCart {
    const items = new Map<number, MenuItem>();

    categories.forEach((category) =>
        category.items.forEach((item) => items.set(item.id, item)),
    );

    const lines: PricedLine[] = [];
    let subtotal = 0;
    let soldOut = 0;
    let dropped = 0;

    cart.lines.forEach((line) => {
        const item = items.get(line.itemId);
        const size = item?.sizes.find((entry) => entry.id === line.sizeId);

        if (item === undefined || size === undefined) {
            dropped += 1;

            return;
        }

        const lineTotal = size.price * line.quantity;

        lines.push({ line, item, size, lineTotal });

        if (item.is_available) {
            subtotal += lineTotal;
        } else {
            soldOut += 1;
        }
    });

    return { lines, subtotal, soldOut, dropped };
}

type StoredCart = {
    version: number;
    savedAt: number;
    lines: CartLine[];
    table: number | null;
};

/** The guest's order survives a refresh, but not a night's sleep. */
export function readCart(now = Date.now()): Cart {
    try {
        const raw = globalThis.localStorage?.getItem(CART_KEY);

        if (!raw) {
            return emptyCart;
        }

        const stored = JSON.parse(raw) as Partial<StoredCart>;

        if (
            stored.version !== VERSION ||
            typeof stored.savedAt !== 'number' ||
            now - stored.savedAt > CART_MAX_AGE_MS ||
            !Array.isArray(stored.lines)
        ) {
            return emptyCart;
        }

        const lines = stored.lines
            .filter(
                (line): line is CartLine =>
                    typeof line?.itemId === 'number' &&
                    typeof line?.sizeId === 'number' &&
                    typeof line?.quantity === 'number',
            )
            .slice(0, MAX_LINES)
            .map((line) => ({
                itemId: line.itemId,
                sizeId: line.sizeId,
                quantity: Math.min(
                    Math.max(Math.trunc(line.quantity), 1),
                    MAX_QUANTITY,
                ),
                note:
                    typeof line.note === 'string'
                        ? line.note.slice(0, MAX_NOTE)
                        : '',
            }));

        return setTable(
            { lines, table: null },
            typeof stored.table === 'number' ? stored.table : null,
        );
    } catch {
        return emptyCart;
    }
}

export function writeCart(cart: Cart, now = Date.now()): void {
    try {
        const stored: StoredCart = {
            version: VERSION,
            savedAt: now,
            lines: cart.lines,
            table: cart.table,
        };

        globalThis.localStorage?.setItem(CART_KEY, JSON.stringify(stored));
    } catch {
        // A blocked or full store only costs the guest their saved order.
    }
}

export function clearCart(): void {
    try {
        globalThis.localStorage?.removeItem(CART_KEY);
    } catch {
        // Nothing to clean up if the store is not there.
    }
}
