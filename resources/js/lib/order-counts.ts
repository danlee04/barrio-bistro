import { createContext, use, useCallback, useEffect, useState } from 'react';
import { http } from '@/lib/http';

export type OrderCounts = {
    /** Open orders at the counter. */
    queue: number;
    /** Paid orders the kitchen still has. */
    kitchen: number;
    /** Paid orders nobody has started cooking. */
    kitchen_new: number;
};

const EMPTY: OrderCounts = { queue: 0, kitchen: 0, kitchen_new: 0 };

/**
 * A way for a screen that just moved an order to tell the sidebar to recount.
 *
 * Without it the badge would stay wrong until the next poll, and a cashier who
 * has just cleared the last order would sit looking at a screen saying one is
 * still waiting.
 */
const RecountContext = createContext<(() => void) | null>(null);

export const OrderCountsProvider = RecountContext.Provider;

/** Recount now. Does nothing outside the admin, which is the right nothing. */
export function useRecountOrders(): () => void {
    return use(RecountContext) ?? (() => undefined);
}

export async function fetchOrderCounts(): Promise<OrderCounts> {
    const response = await http.get<{ data: OrderCounts }>(
        '/api/v1/staff/order-counts',
    );

    return response.data;
}

/**
 * Keep the sidebar badges current while somebody is looking at the screen.
 *
 * A tab left open in the back office stops asking until it is looked at
 * again, and a failed call leaves the last known numbers alone rather than
 * blanking the badges over one dropped connection.
 */
export function useOrderCounts(intervalMs: number): {
    counts: OrderCounts;
    recount: () => void;
} {
    const [counts, setCounts] = useState<OrderCounts>(EMPTY);

    // Asked for by hand after a staff member moves an order, so it does not
    // check whether the tab is hidden: they are plainly looking at it.
    const recount = useCallback(() => {
        fetchOrderCounts()
            .then(setCounts)
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        let cancelled = false;

        function refresh() {
            if (document.hidden) {
                return;
            }

            fetchOrderCounts()
                .then((fresh) => {
                    if (!cancelled) {
                        setCounts(fresh);
                    }
                })
                .catch(() => undefined);
        }

        refresh();

        const timer = window.setInterval(refresh, intervalMs);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [intervalMs]);

    return { counts, recount };
}
