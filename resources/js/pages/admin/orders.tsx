import { useEffect, useState } from 'react';
import { useLoaderData, useRouteLoaderData } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { OrderCard } from '@/components/ops/order-card';
import { Button } from '@/components/ui/button';
import type { staffLoader } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import { markOrderPaid, type queueLoader, updateOrderStatus } from '@/lib/ops';
import { useRecountOrders } from '@/lib/order-counts';
import { useStaffOrders } from '@/lib/ops-polling';
import { cn } from '@/lib/utils';
import type { OpsView, StaffOrder } from '@/types';

const tabs: { view: OpsView; label: string }[] = [
    { view: 'queue', label: 'Open' },
    { view: 'done', label: 'Done today' },
];

export default function Orders() {
    const initial = useLoaderData<typeof queueLoader>();
    const staff = useRouteLoaderData<typeof staffLoader>('admin');
    const canManage = staff?.abilities.manage_orders ?? false;

    const [view, setView] = useState<OpsView>('queue');
    const [orders, setOrders] = useStaffOrders(view, initial, 7000);
    const [now, setNow] = useState(() => Date.now());
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [cancelling, setCancelling] = useState<StaffOrder | null>(null);
    const recount = useRecountOrders();

    // The waiting times move on their own, without asking the server again.
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);

        return () => window.clearInterval(timer);
    }, []);

    function replace(order: StaffOrder) {
        setOrders(
            view === 'queue' &&
                (order.status === 'completed' || order.status === 'cancelled')
                ? orders.filter((entry) => entry.token !== order.token)
                : orders.map((entry) =>
                      entry.token === order.token ? order : entry,
                  ),
        );
    }

    async function run(order: StaffOrder, action: () => Promise<StaffOrder>) {
        setErrors((current) => ({ ...current, [order.token]: '' }));

        try {
            replace(await action());
            recount();
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

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Orders</h1>

                <div
                    role="group"
                    aria-label="Which orders"
                    className="flex gap-2"
                >
                    {tabs.map((tab) => (
                        <button
                            key={tab.view}
                            type="button"
                            aria-pressed={view === tab.view}
                            onClick={() => setView(tab.view)}
                            className={cn(
                                'min-h-11 rounded-full border px-4 font-medium',
                                view === tab.view
                                    ? 'border-dahon bg-dahon text-pandan'
                                    : 'border-border bg-card',
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {orders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                    {view === 'queue'
                        ? 'Nothing waiting. The counter is clear.'
                        : 'Nothing finished yet today.'}
                </p>
            ) : (
                <ul className="gap-5 sm:columns-2 md:columns-3 xl:columns-4">
                    {orders.map((order) => (
                        <li
                            key={order.token}
                            className="mb-5 flex break-inside-avoid flex-col gap-1"
                        >
                            <OrderCard order={order} now={now}>
                                {canManage &&
                                    order.payment_status === 'unpaid' &&
                                    order.status === 'pending' && (
                                        <Button
                                            type="button"
                                            className="min-h-11"
                                            onClick={() =>
                                                void run(order, () =>
                                                    markOrderPaid(order.token),
                                                )
                                            }
                                        >
                                            Mark as Paid
                                        </Button>
                                    )}

                                {canManage && order.status === 'ready' && (
                                    <Button
                                        type="button"
                                        className="min-h-11"
                                        onClick={() =>
                                            void run(order, () =>
                                                updateOrderStatus(
                                                    order.token,
                                                    'completed',
                                                ),
                                            )
                                        }
                                    >
                                        Handed over
                                    </Button>
                                )}

                                {canManage &&
                                    order.payment_status === 'unpaid' &&
                                    order.status === 'pending' && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="min-h-11"
                                            onClick={() => setCancelling(order)}
                                        >
                                            Cancel
                                        </Button>
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

            {cancelling && (
                <ConfirmDialog
                    title={`Cancel order ${String(cancelling.daily_number).padStart(4, '0')}?`}
                    description="Only unpaid orders can be cancelled. The kitchen never saw this one."
                    confirmLabel="Cancel order"
                    onConfirm={async () => {
                        await run(cancelling, () =>
                            updateOrderStatus(
                                cancelling.token,
                                'cancelled',
                                'Cancelled at the counter',
                            ),
                        );
                    }}
                    onClose={() => setCancelling(null)}
                />
            )}
        </div>
    );
}
