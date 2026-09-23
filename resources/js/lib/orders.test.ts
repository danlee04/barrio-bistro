import { beforeEach, describe, expect, it } from 'vite-plus/test';
import {
    forgetOrder,
    RECENT_ORDER_MAX_AGE_MS,
    recentOrder,
    rememberOrder,
} from '@/lib/orders';

beforeEach(() => {
    const store = new Map<string, string>();

    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => void store.set(key, value),
            removeItem: (key: string) => void store.delete(key),
        } as unknown as Storage,
    });
});

describe('recent order', () => {
    it('remembers the order the guest just placed', () => {
        rememberOrder('01JB8ZQ3K7WY5S9T2V4XRD6M8N', 1_000);

        expect(recentOrder(1_000)).toBe('01JB8ZQ3K7WY5S9T2V4XRD6M8N');
    });

    it('lets go after the meal is long over', () => {
        rememberOrder('01JB8ZQ3K7WY5S9T2V4XRD6M8N', 1_000);

        expect(recentOrder(1_000 + RECENT_ORDER_MAX_AGE_MS + 1)).toBeNull();
    });

    it('forgets on request and ignores nonsense', () => {
        rememberOrder('01JB8ZQ3K7WY5S9T2V4XRD6M8N', 1_000);
        forgetOrder();

        expect(recentOrder(1_000)).toBeNull();

        globalThis.localStorage.setItem('bb.order', 'not json');

        expect(recentOrder(1_000)).toBeNull();
    });
});
