import { useEffect, useState } from 'react';
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
export function useOrderCounts(intervalMs: number): OrderCounts {
    const [counts, setCounts] = useState<OrderCounts>(EMPTY);

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

    return counts;
}
