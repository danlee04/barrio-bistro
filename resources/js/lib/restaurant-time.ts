import type { OpeningHours } from '@/content/restaurant';

export type DayPart = 'morning' | 'afternoon' | 'tonight';

export type OpenStatus =
    | { isOpen: true; closesAt: string }
    | {
          isOpen: false;
          opensAt: string | null;
          opensDay: number | null;
          opensToday: boolean;
      };

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Day of week (0 = Sunday) and minutes after midnight on the wall clock of a time zone. */
export function zonedParts(
    date: Date,
    timeZone: string,
): { day: number; minutes: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);

    const part = (type: string) =>
        parts.find((entry) => entry.type === type)?.value ?? '';

    return {
        day: weekdays.indexOf(part('weekday')),
        minutes: Number(part('hour')) * 60 + Number(part('minute')),
    };
}

/** Morning 05:00–11:59, afternoon 12:00–16:59, tonight otherwise. */
export function dayPart(date: Date, timeZone: string): DayPart {
    const { minutes } = zonedParts(date, timeZone);

    if (minutes >= 5 * 60 && minutes < 12 * 60) {
        return 'morning';
    }

    if (minutes >= 12 * 60 && minutes < 17 * 60) {
        return 'afternoon';
    }

    return 'tonight';
}

function toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);

    return hours * 60 + minutes;
}

/** Whether the restaurant is open now, and when it closes or next opens. */
export function openStatus(
    date: Date,
    hours: OpeningHours[],
    timeZone: string,
): OpenStatus {
    const now = zonedParts(date, timeZone);
    const today = hours.find((entry) => entry.day === now.day);

    if (
        today &&
        now.minutes >= toMinutes(today.opens) &&
        now.minutes < toMinutes(today.closes)
    ) {
        return { isOpen: true, closesAt: today.closes };
    }

    if (today && now.minutes < toMinutes(today.opens)) {
        return {
            isOpen: false,
            opensAt: today.opens,
            opensDay: now.day,
            opensToday: true,
        };
    }

    for (let offset = 1; offset <= 7; offset += 1) {
        const day = (now.day + offset) % 7;
        const next = hours.find((entry) => entry.day === day);

        if (next) {
            return {
                isOpen: false,
                opensAt: next.opens,
                opensDay: day,
                opensToday: false,
            };
        }
    }

    return { isOpen: false, opensAt: null, opensDay: null, opensToday: false };
}

/** "21:00" → "9:00 PM". */
export function formatClock(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;

    return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
