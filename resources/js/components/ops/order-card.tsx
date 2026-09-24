import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatPeso } from '@/lib/money';
import { elapsedLabel, HURRY_MINUTES, minutesWaiting } from '@/lib/ops';
import { cn } from '@/lib/utils';
import type { OrderStatus, StaffOrder } from '@/types';

type OrderCardProps = {
    order: StaffOrder;
    now: number;
    /** Minutes after which the waiting time starts shouting. */
    hurryAfter?: number;
    children?: ReactNode;
};

/** Orders nobody is waiting on any more: lateness means nothing here. */
const settled: OrderStatus[] = ['completed', 'cancelled'];

/**
 * How far each ticket leans. Picked from the order's own number rather than at
 * random, so a note never jumps to a new angle while someone is reading it.
 * The swing on hover leans off whichever angle the paper already has.
 */
const tilts = [
    '[--tilt:-2deg]',
    '[--tilt:1deg]',
    '[--tilt:0deg]',
    '[--tilt:2deg]',
    '[--tilt:-1deg]',
];

/** One order, as both the counter and the kitchen read it. */
export function OrderCard({
    order,
    now,
    hurryAfter = HURRY_MINUTES,
    children,
}: OrderCardProps) {
    const waitedMinutes = minutesWaiting(order.placed_at, now);

    const isOpen = !settled.includes(order.status);
    const late = isOpen && waitedMinutes >= hurryAfter;
    const paid = order.payment_status === 'paid';

    // Where it goes matters more than what kind it is, but the kind still has
    // to be said: a name alone never tells the kitchen whether to pack it.
    const where =
        order.table_number !== null
            ? `Table ${order.table_number}`
            : order.customer_name;

    return (
        <article
            className={cn(
                'ticket flex flex-col gap-2.5 p-3 pt-5',
                tilts[order.daily_number % tilts.length],
                late && 'ticket-late',
            )}
        >
            <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-col">
                    <p className="font-display text-4xl leading-none font-bold tabular-nums">
                        {String(order.daily_number).padStart(4, '0')}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-semibold">
                            {where ?? order.type_label}
                        </span>
                        {where !== null && (
                            <span className="text-muted-foreground">
                                {order.type_label}
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                        <Badge
                            variant="outline"
                            className="border-uling/25 bg-papel"
                        >
                            {order.status_label}
                        </Badge>
                        <Badge
                            className={cn(
                                paid
                                    ? 'bg-kalamansi text-uling'
                                    : 'bg-achuete text-white',
                            )}
                        >
                            {paid ? 'Paid' : 'Unpaid'}
                        </Badge>
                    </div>
                    <p
                        className={cn(
                            'text-sm text-muted-foreground',
                            late && 'font-semibold text-achuete',
                        )}
                    >
                        {elapsedLabel(order.placed_at, now)}
                    </p>
                </div>
            </header>

            <ul className="flex flex-col gap-1.5 border-t border-uling/12 pt-2.5">
                {order.items.map((item) => (
                    <li key={item.id} className="flex gap-2.5 text-sm">
                        <span className="w-7 shrink-0 text-right font-bold tabular-nums">
                            {item.quantity}×
                        </span>
                        <span className="flex min-w-0 flex-col gap-1">
                            <span className="font-medium">
                                {item.item_name}
                                <span className="font-normal text-muted-foreground">{` ${item.size_name}`}</span>
                            </span>
                            {item.note && (
                                <span className="border-l-2 border-achuete pl-2 font-semibold text-achuete">
                                    {item.note}
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-uling/12 pt-2.5">
                <p className="font-display text-lg font-bold tabular-nums">
                    {formatPeso(order.total)}
                </p>
                <div className="flex flex-wrap gap-2">{children}</div>
            </footer>
        </article>
    );
}
