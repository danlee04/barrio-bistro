import { useEffect, useRef, useState } from 'react';
import {
    Link,
    useLoaderData,
    useRevalidator,
    useSearchParams,
} from 'react-router';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import { HttpError } from '@/lib/http';
import { formatPeso } from '@/lib/money';
import { useOrderUpdates } from '@/lib/order-polling';
import { type orderLoader, rememberOrder } from '@/lib/orders';
import { createCheckoutSession, refreshPayment } from '@/lib/payments';
import { cn } from '@/lib/utils';
import type { OrderStatus as Status } from '@/types';

const unavailable =
    'Online payment is not available right now. Please pay at the counter.';

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

    const [searchParams, setSearchParams] = useSearchParams();
    const revalidator = useRevalidator();
    const [paying, setPaying] = useState(false);
    const [payError, setPayError] = useState<string | null>(null);
    const checked = useRef(false);

    useEffect(() => {
        rememberOrder(order.token);
    }, [order.token]);

    // Back from PayMongo: our server asks them how it went — the browser's own
    // word is never enough — and then the page reloads the order.
    useEffect(() => {
        if (searchParams.get('paid') !== '1' || checked.current) {
            return;
        }

        checked.current = true;

        refreshPayment(order.token)
            .then(() => {
                const next = new URLSearchParams(searchParams);
                next.delete('paid');
                setSearchParams(next, { replace: true });
                void revalidator.revalidate();
            })
            .catch(() => undefined);
    }, [order.token, revalidator, searchParams, setSearchParams]);

    async function handlePayOnline() {
        setPaying(true);
        setPayError(null);

        try {
            const payment = await createCheckoutSession(order.token);

            if (payment.checkout_url !== null) {
                window.location.assign(payment.checkout_url);

                return;
            }

            setPayError(unavailable);
        } catch (failure) {
            setPayError(
                failure instanceof HttpError && failure.body.message
                    ? failure.body.message
                    : unavailable,
            );
        }

        setPaying(false);
    }

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
                ) : order.payment_status === 'paid' ? (
                    <p className="rounded-xl border-2 border-kalamansi bg-card p-4">
                        <span className="font-display text-xl font-extrabold">
                            Paid.
                        </span>{' '}
                        Thank you — the kitchen has your order.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3 rounded-xl border-2 border-achuete bg-card p-4">
                        <p>
                            <span className="font-display text-xl font-extrabold">
                                Not paid yet.
                            </span>{' '}
                            Show this number at the counter, or pay online now.
                        </p>

                        <Button
                            type="button"
                            className="min-h-12 w-fit rounded-full px-6"
                            disabled={paying}
                            onClick={handlePayOnline}
                        >
                            {paying ? 'Opening…' : 'Pay online'}
                        </Button>

                        {payError && (
                            <p
                                role="alert"
                                className="font-semibold text-destructive"
                            >
                                {payError}
                            </p>
                        )}
                    </div>
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
