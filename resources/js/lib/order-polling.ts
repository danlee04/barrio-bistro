import { useEffect, useState } from 'react';
import { fetchOrder } from '@/lib/orders';
import type { Order } from '@/types';

export const POLL_INTERVAL_MS = 15_000;

/**
 * Keep an order fresh while the guest is watching it. The poll pauses with the
 * tab hidden and stops for good once the order is finished, so a restaurant
 * full of phones behind one router stays inside the rate limit.
 */
export function useOrderUpdates(initial: Order): Order {
    const [order, setOrder] = useState(initial);

    useEffect(() => {
        setOrder(initial);
    }, [initial]);

    useEffect(() => {
        if (order.status === 'completed' || order.status === 'cancelled') {
            return;
        }

        let stopped = false;

        const timer = window.setInterval(() => {
            if (document.hidden) {
                return;
            }

            fetchOrder(order.token)
                .then((fresh) => {
                    if (!stopped) {
                        setOrder(fresh);
                    }
                })
                .catch(() => undefined);
        }, POLL_INTERVAL_MS);

        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [order.token, order.status]);

    return order;
}
