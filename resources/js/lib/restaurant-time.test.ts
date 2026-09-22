import { describe, expect, it } from 'vite-plus/test';
import type { OpeningHours } from '@/content/restaurant';
import {
    dayPart,
    formatClock,
    openStatus,
    zonedParts,
} from '@/lib/restaurant-time';

const MANILA = 'Asia/Manila';

// 2026-09-22 is a Tuesday; Manila is UTC+8.
const at = (utc: string) => new Date(`2026-09-22T${utc}Z`);

const hours: OpeningHours[] = [
    { day: 0, opens: '08:00', closes: '21:00' },
    { day: 1, opens: '10:00', closes: '21:00' },
    { day: 2, opens: '10:00', closes: '21:00' },
    { day: 3, opens: '10:00', closes: '21:00' },
    { day: 4, opens: '10:00', closes: '21:00' },
    { day: 5, opens: '10:00', closes: '22:00' },
    { day: 6, opens: '10:00', closes: '22:00' },
];

describe('zonedParts', () => {
    it('reads the wall clock in Manila, not the device time zone', () => {
        expect(zonedParts(at('04:00:00'), MANILA)).toEqual({
            day: 2,
            minutes: 12 * 60,
        });
        expect(zonedParts(at('17:30:00'), MANILA)).toEqual({
            day: 3,
            minutes: 90,
        });
    });
});

describe('dayPart', () => {
    it.each([
        ['01:30:00', 'morning'],
        ['03:59:00', 'morning'],
        ['04:00:00', 'afternoon'],
        ['08:59:00', 'afternoon'],
        ['09:00:00', 'tonight'],
        ['20:00:00', 'tonight'],
    ])('at %s UTC it is %s in Manila', (utc, expected) => {
        expect(dayPart(at(utc), MANILA)).toBe(expected);
    });
});

describe('openStatus', () => {
    it('is open during the day and says when it closes', () => {
        expect(openStatus(at('04:00:00'), hours, MANILA)).toEqual({
            isOpen: true,
            closesAt: '21:00',
        });
    });

    it('is closed before opening and says it opens later today', () => {
        expect(openStatus(at('01:30:00'), hours, MANILA)).toEqual({
            isOpen: false,
            opensAt: '10:00',
            opensDay: 2,
            opensToday: true,
        });
    });

    it('is closed after closing and points to the next day', () => {
        expect(openStatus(at('14:00:00'), hours, MANILA)).toEqual({
            isOpen: false,
            opensAt: '10:00',
            opensDay: 3,
            opensToday: false,
        });
    });

    it('skips days the restaurant is closed', () => {
        const weekdaysOnly = hours.filter(
            (entry) => entry.day >= 1 && entry.day <= 5,
        );

        // Friday 23:00 Manila → next opening is Monday.
        expect(
            openStatus(new Date('2026-09-25T15:00:00Z'), weekdaysOnly, MANILA),
        ).toEqual({
            isOpen: false,
            opensAt: '10:00',
            opensDay: 1,
            opensToday: false,
        });
    });

    it('knows when there are no hours at all', () => {
        expect(openStatus(at('04:00:00'), [], MANILA)).toEqual({
            isOpen: false,
            opensAt: null,
            opensDay: null,
            opensToday: false,
        });
    });
});

describe('formatClock', () => {
    it.each([
        ['21:00', '9:00 PM'],
        ['10:30', '10:30 AM'],
        ['12:00', '12:00 PM'],
        ['00:15', '12:15 AM'],
    ])('shows %s as %s', (time, expected) => {
        expect(formatClock(time)).toBe(expected);
    });
});
