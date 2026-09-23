import { useEffect } from 'react';
import { Link, useLoaderData } from 'react-router';
import { restaurant } from '@/content/restaurant';
import { formatPeso } from '@/lib/money';
import { useOrderUpdates } from '@/lib/order-polling';
import { type orderLoader, rememberOrder } from '@/lib/orders';
import { cn } from '@/lib/utils';
import type { OrderStatus as Status } from '@/types';

const steps: { status: Status; label: string }[] = [
    { status: 'pending', label: 'Placed' },
    { status: 'confirmed', label: 'Paid' },
    { status: 'preparing', label: 'Cooking' },
    { status: 'ready', label: 'Ready' },
    { status: 'completed', label: 'Served' },
];

export default function OrderStatus() {
    const initial = useLoaderData<typeof orderLoader>();
    const order = useOrderUpdates(initial);
    const current = steps.findIndex((step) => step.status === order.status);

    useEffect(() => {
        rememberOrder(order.token);
    }, [order.token]);

    return (
        <>
            <title>{`Order ${order.order_number} | ${restaurant.name}`}</title>

            <div className="wrapper flex flex-col gap-8 py-10">
                <header className="flex flex-col gap-1">
                    <p className="text-lg text-muted-foreground">Your number</p>
                    <p className="font-display text-[clamp(4rem,2rem+12vw,8rem)] leading-none font-extrabold tracking-tight">
                        {String(order.daily_number).padStart(4, '0')}
                    </p>
                    <p className="text-muted-foreground">
                        {order.order_number}
                    </p>
                </header>

                {order.status === 'cancelled' ? (
                    <p className="rounded-xl border-2 border-destructive bg-card p-4 font-semibold text-destructive">
                        This order was cancelled. Talk to the counter if that is
                        a surprise.
                    </p>
                ) : (
                    order.payment_status === 'unpaid' && (
                        <p className="rounded-xl border-2 border-achuete bg-card p-4">
                            <span className="font-display text-xl font-extrabold">
                                Pay at the counter.
                            </span>{' '}
                            Show this number and the kitchen starts right after.
                        </p>
                    )
                )}

                {order.status !== 'cancelled' && (
                    <ol className="flex flex-wrap gap-2">
                        {steps.map((step, index) => (
                            <li
                                key={step.status}
                                aria-current={
                                    index === current ? 'step' : undefined
                                }
                                className={cn(
                                    'rounded-full border px-4 py-2 font-medium',
                                    index < current &&
                                        'border-dahon text-dahon',
                                    index === current &&
                                        'border-dahon bg-dahon font-semibold text-pandan',
                                    index > current &&
                                        'border-border text-muted-foreground',
                                )}
                            >
                                {step.label}
                            </li>
                        ))}
                    </ol>
                )}

                <dl className="grid grid-cols-[auto_auto] justify-start gap-x-6 gap-y-1">
                    <dt className="text-muted-foreground">Order</dt>
                    <dd className="font-medium">{order.type_label}</dd>

                    {order.table_number !== null && (
                        <>
                            <dt className="text-muted-foreground">Table</dt>
                            <dd className="font-medium">
                                {order.table_number}
                            </dd>
                        </>
                    )}

                    {order.customer_name !== null && (
                        <>
                            <dt className="text-muted-foreground">Name</dt>
                            <dd className="font-medium">
                                {order.customer_name}
                            </dd>
                        </>
                    )}

                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium">{order.status_label}</dd>
                </dl>

                <ul className="flex flex-col divide-y divide-border border-y border-border">
                    {order.items.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-start gap-4 py-4"
                        >
                            <p className="font-display text-lg font-extrabold">
                                {item.quantity}×
                            </p>

                            <div className="flex min-w-0 flex-1 flex-col">
                                <p className="font-semibold">
                                    {item.item_name}
                                    <span className="font-normal text-muted-foreground">
                                        {` · ${item.size_name}`}
                                    </span>
                                </p>
                                {item.note && (
                                    <p className="text-muted-foreground">
                                        {item.note}
                                    </p>
                                )}
                            </div>

                            <p className="font-display font-extrabold">
                                {formatPeso(item.line_total)}
                            </p>
                        </li>
                    ))}
                </ul>

                <p className="font-display text-2xl font-extrabold">
                    Total {formatPeso(order.total)}
                </p>

                <Link
                    to="/menu"
                    className="text-lg underline underline-offset-4"
                >
                    Back to the menu
                </Link>
            </div>
        </>
    );
}
