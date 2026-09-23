import { describe, expect, it } from 'vite-plus/test';
import { elapsedLabel, newTokens } from '@/lib/ops';

const now = Date.parse('2026-09-23T12:00:00+08:00');

describe('elapsedLabel', () => {
    it('reads the wait the way a cashier says it', () => {
        expect(elapsedLabel('2026-09-23T11:59:30+08:00', now)).toBe('just now');
        expect(elapsedLabel('2026-09-23T11:56:00+08:00', now)).toBe('4m');
        expect(elapsedLabel('2026-09-23T10:55:00+08:00', now)).toBe('1h 5m');
    });

    it('never reads the future as a wait', () => {
        expect(elapsedLabel('2026-09-23T12:05:00+08:00', now)).toBe('just now');
    });

    it('says nothing useful about nothing', () => {
        expect(elapsedLabel(null, now)).toBe('');
    });
});

describe('newTokens', () => {
    it('finds what arrived since the last look', () => {
        expect(newTokens(['a', 'b'], ['c', 'a', 'b'])).toEqual(['c']);
    });

    it('is quiet when nothing is new', () => {
        expect(newTokens(['a', 'b'], ['b', 'a'])).toEqual([]);
        expect(newTokens(['a'], [])).toEqual([]);
    });
});
