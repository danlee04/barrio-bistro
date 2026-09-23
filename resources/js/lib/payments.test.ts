import { describe, expect, it } from 'vite-plus/test';
import { canPayOnline } from '@/lib/payments';
import type { CheckoutOptions } from '@/types';

const online: CheckoutOptions = {
    tables: 20,
    methods: ['counter', 'online'],
    online_minimum: 10000,
};

const counterOnly: CheckoutOptions = {
    tables: 20,
    methods: ['counter'],
    online_minimum: 10000,
};

describe('canPayOnline', () => {
    it('offers online payment once the order reaches the minimum', () => {
        expect(canPayOnline(10000, online)).toBe(true);
        expect(canPayOnline(36000, online)).toBe(true);
    });

    it('keeps small orders at the counter', () => {
        expect(canPayOnline(9999, online)).toBe(false);
    });

    it('says no when the restaurant has no payment provider', () => {
        expect(canPayOnline(36000, counterOnly)).toBe(false);
    });
});
