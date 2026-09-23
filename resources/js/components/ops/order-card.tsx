import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatPeso } from '@/lib/money';
import { elapsedLabel } from '@/lib/ops';
import { cn } from '@/lib/utils';
import type { StaffOrder } from '@/types';

type OrderCardProps = {
    order: StaffOrder;
    now: number;
    /** Minutes after which the waiting time starts shouting. */
    hurryAfter?: number;
    children?: ReactNode;
};

/** One order, as both the counter and the kitchen read it. */
export function OrderCard({
    order,
    now,
    hurryAfter = 10,
    children,
}: OrderCardProps) {
    const waitedMinutes =
        order.placed_at === null
            ? 0
            : Math.floor((now - Date.parse(order.placed_at)) / 60_000);

    return (
        <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <header className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-3xl leading-none font-bold">
                        {String(order.daily_number).padStart(4, '0')}
                    </p>
                    <p className="font-medium">
                        {order.table_number !== null
                            ? `Table ${order.table_number}`
                            : (order.customer_name ?? order.type_label)}
                    </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                        variant="outline"
                        className={cn(
                            order.payment_status === 'paid'
                                ? 'border-kalamansi bg-kalamansi text-uling'
                                : 'border-achuete text-achuete',
                        )}
                    >
                        {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </Badge>
                    <p
                        className={cn(
                            'text-sm text-muted-foreground',
                            waitedMinutes >= hurryAfter &&
                                'font-semibold text-achuete',
                        )}
                    >
                        {elapsedLabel(order.placed_at, now)}
                    </p>
                </div>
            </header>

            <ul className="flex flex-col gap-1">
                {order.items.map((item) => (
                    <li key={item.id} className="flex gap-2">
                        <span className="font-bold">{item.quantity}×</span>
                        <span className="flex min-w-0 flex-col">
                            <span>
                                {item.item_name}
                                <span className="text-muted-foreground">{` · ${item.size_name}`}</span>
                            </span>
                            {item.note && (
                                <span className="font-semibold text-achuete">
                                    {item.note}
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p className="text-lg font-bold">{formatPeso(order.total)}</p>
                <div className="flex flex-wrap gap-2">{children}</div>
            </footer>
        </article>
    );
}
