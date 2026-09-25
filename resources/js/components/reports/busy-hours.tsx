import { cn } from '@/lib/utils';
import type { HourSlot } from '@/types';

/** The shortest a bar may be drawn, so an hour with one order is still visible. */
const FLOOR = 6;

/**
 * When the shop fills up, read across the whole week rather than today: one
 * day is a rumour, a week is a pattern. The busiest hour is named in words as
 * well as drawn, because a bar chart this small is a shape, not a reading.
 */
export function BusyHours({ hours }: { hours: HourSlot[] }) {
    const busiest = hours.reduce<HourSlot | null>(
        (best, slot) =>
            best === null || slot.orders > best.orders ? slot : best,
        null,
    );
    const most = busiest?.orders ?? 0;

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">When it gets busy</h2>

            {busiest === null || most === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No paid orders this week yet.
                </p>
            ) : (
                <>
                    <ul
                        role="img"
                        aria-label={`Orders by hour over the last week. Busiest at ${busiest.label} with ${busiest.orders}.`}
                        className="flex h-24 items-end gap-1"
                    >
                        {hours.map((slot) => (
                            <li
                                key={slot.hour}
                                title={`${slot.label}: ${slot.orders} ${slot.orders === 1 ? 'order' : 'orders'}`}
                                className="flex h-full flex-1 items-end"
                            >
                                <div
                                    className={cn(
                                        'w-full rounded-t-sm',
                                        slot.hour === busiest.hour
                                            ? 'bg-achuete'
                                            : 'bg-dahon/35',
                                    )}
                                    style={{
                                        height: `${Math.max(FLOOR, (slot.orders / most) * 100)}%`,
                                    }}
                                />
                            </li>
                        ))}
                    </ul>

                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{hours[0]?.label}</span>
                        <span>{hours.at(-1)?.label}</span>
                    </div>

                    <p className="text-sm">
                        Busiest at{' '}
                        <span className="font-semibold">{busiest.label}</span> —{' '}
                        {busiest.orders}{' '}
                        {busiest.orders === 1 ? 'order' : 'orders'} this week.
                    </p>
                </>
            )}
        </div>
    );
}
