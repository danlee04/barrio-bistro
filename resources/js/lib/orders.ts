import type { LoaderFunctionArgs } from 'react-router';
import { http } from '@/lib/http';
import type { Order, PlaceOrderInput } from '@/types';

type Wrapped<T> = { data: T };

export const RECENT_ORDER_KEY = 'bb.order';
export const RECENT_ORDER_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
    const response = await http.post<Wrapped<Order>>('/api/v1/orders', input);

    return response.data;
}

export async function fetchOrder(token: string): Promise<Order> {
    const response = await http.get<Wrapped<Order>>(`/api/v1/orders/${token}`);

    return response.data;
}

/** Loader: the order behind /order/:token. */
export function orderLoader({ params }: LoaderFunctionArgs): Promise<Order> {
    return fetchOrder(String(params.token));
}

type StoredOrder = { token: string; savedAt: number };

/** Keep the last order within reach while the guest is still eating. */
export function rememberOrder(token: string, now = Date.now()): void {
    try {
        const stored: StoredOrder = { token, savedAt: now };

        globalThis.localStorage?.setItem(
            RECENT_ORDER_KEY,
            JSON.stringify(stored),
        );
    } catch {
        // Without storage the guest simply loses the shortcut.
    }
}

export function recentOrder(now = Date.now()): string | null {
    try {
        const raw = globalThis.localStorage?.getItem(RECENT_ORDER_KEY);

        if (!raw) {
            return null;
        }

        const stored = JSON.parse(raw) as Partial<StoredOrder>;

        if (
            typeof stored.token !== 'string' ||
            typeof stored.savedAt !== 'number' ||
            now - stored.savedAt > RECENT_ORDER_MAX_AGE_MS
        ) {
            return null;
        }

        return stored.token;
    } catch {
        return null;
    }
}

export function forgetOrder(): void {
    try {
        globalThis.localStorage?.removeItem(RECENT_ORDER_KEY);
    } catch {
        // Nothing to clean up if the store is not there.
    }
}
