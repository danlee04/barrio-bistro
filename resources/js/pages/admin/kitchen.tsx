import { useEffect, useRef, useState } from 'react';
import { useLoaderData, useRouteLoaderData } from 'react-router';
import { OrderCard } from '@/components/ops/order-card';
import { Button } from '@/components/ui/button';
import type { staffLoader } from '@/lib/auth';
import { chimeMuted, playChime, setChimeMuted } from '@/lib/chime';
import { HttpError } from '@/lib/http';
import { type kitchenLoader, newTokens, updateOrderStatus } from '@/lib/ops';
import { useStaffOrders } from '@/lib/ops-polling';
import type { OrderStatus, StaffOrder } from '@/types';

const columns: {
    status: OrderStatus;
    label: string;
    next: OrderStatus | null;
    action: string;
}[] = [
    {
        status: 'confirmed',
        label: 'New',
        next: 'preparing',
        action: 'Start cooking',
    },
    { status: 'preparing', label: 'Cooking', next: 'ready', action: 'Ready' },
    { status: 'ready', label: 'Ready', next: null, action: '' },
];

export default function Kitchen() {
    const initial = useLoaderData<typeof kitchenLoader>();
    const staff = useRouteLoaderData<typeof staffLoader>('admin');
    const canCook = staff?.abilities.cook_orders ?? false;

    const [orders, setOrders] = useStaffOrders('kitchen', initial, 5000);
    const [now, setNow] = useState(() => Date.now());
    const [muted, setMuted] = useState(() => chimeMuted());
    const [errors, setErrors] = useState<Record<string, string>>({});
    const seen = useRef<string[] | null>(null);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);

        return () => window.clearInterval(timer);
    }, []);

    // A dish that just arrived deserves a sound, but not on the first paint.
    useEffect(() => {
        const waiting = orders
            .filter((order) => order.status === 'confirmed')
            .map((order) => order.token);

        if (
            seen.current !== null &&
            newTokens(seen.current, waiting).length > 0
        ) {
            playChime();
        }

        seen.current = waiting;
    }, [orders]);

    async function advance(order: StaffOrder, next: OrderStatus) {
        setErrors((current) => ({ ...current, [order.token]: '' }));

        try {
            const updated = await updateOrderStatus(order.token, next);

            setOrders(
                orders.map((entry) =>
                    entry.token === order.token ? updated : entry,
                ),
            );
        } catch (failure) {
            setErrors((current) => ({
                ...current,
                [order.token]:
                    failure instanceof HttpError && failure.body.message
                        ? failure.body.message
                        : 'That did not go through. Try again.',
            }));
        }
    }

    function toggleSound() {
        const next = !muted;

        setChimeMuted(next);
        setMuted(next);

        if (!next) {
            playChime();
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="font-display text-3xl font-extrabold tracking-tight">
                    Kitchen
                </h1>

                <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    aria-pressed={!muted}
                    onClick={toggleSound}
                >
                    {muted ? 'Sound off' : 'Sound on'}
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {columns.map((column) => {
                    const inColumn = orders.filter(
                        (order) => order.status === column.status,
                    );

                    return (
                        <section
                            key={column.status}
                            aria-labelledby={`column-${column.status}`}
                            className="flex flex-col gap-3"
                        >
                            <h2
                                id={`column-${column.status}`}
                                className="font-display text-xl font-extrabold"
                            >
                                {column.label}
                                <span className="ml-2 text-muted-foreground">
                                    {inColumn.length}
                                </span>
                            </h2>

                            {inColumn.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
                                    —
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-3">
                                    {inColumn.map((order) => (
                                        <li
                                            key={order.token}
                                            className="flex flex-col gap-1"
                                        >
                                            <OrderCard order={order} now={now}>
                                                {column.next !== null &&
                                                canCook ? (
                                                    <Button
                                                        type="button"
                                                        className="min-h-11"
                                                        onClick={() =>
                                                            void advance(
                                                                order,
                                                                column.next as OrderStatus,
                                                            )
                                                        }
                                                    >
                                                        {column.action}
                                                    </Button>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">
                                                        {column.next === null
                                                            ? 'Waiting for the counter'
                                                            : order.status_label}
                                                    </p>
                                                )}
                                            </OrderCard>

                                            {errors[order.token] && (
                                                <p
                                                    role="alert"
                                                    className="text-sm font-semibold text-destructive"
                                                >
                                                    {errors[order.token]}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
