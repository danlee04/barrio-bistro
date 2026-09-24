import { describe, expect, it } from 'vite-plus/test';
import { statusFilterFrom } from '@/lib/inquiries';

describe('the message-book filter', () => {
    it('reads a known status out of the URL', () => {
        expect(statusFilterFrom('closed')).toBe('closed');
        expect(statusFilterFrom('all')).toBe('all');
    });

    it('falls back to the new messages when the URL says nothing useful', () => {
        expect(statusFilterFrom(null)).toBe('new');
        expect(statusFilterFrom('')).toBe('new');
        expect(statusFilterFrom('deleted')).toBe('new');
    });
});
