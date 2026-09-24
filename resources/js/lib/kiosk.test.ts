import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { IDLE_MS, isIdle, isKiosk, setKiosk } from '@/lib/kiosk';

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

describe('kiosk mode', () => {
    it('is off until the shop turns it on, and can be turned off again', () => {
        expect(isKiosk()).toBe(false);

        setKiosk(true);
        expect(isKiosk()).toBe(true);

        setKiosk(false);
        expect(isKiosk()).toBe(false);
    });
});

describe('isIdle', () => {
    it('waits out the whole window before calling an order abandoned', () => {
        expect(isIdle(1_000, 1_000 + IDLE_MS - 1)).toBe(false);
        expect(isIdle(1_000, 1_000 + IDLE_MS)).toBe(true);
    });
});
