import { useEffect, useState } from 'react';
import { listStaffOrders } from '@/lib/ops';
import type { OpsView, StaffOrder } from '@/types';

/**
 * Keep a staff screen fresh while somebody is looking at it. A tab left open in
 * the back office stops asking until it is looked at again.
 */
export function useStaffOrders(
    view: OpsView,
    initial: StaffOrder[],
    intervalMs: number,
): [StaffOrder[], (orders: StaffOrder[]) => void] {
    const [orders, setOrders] = useState(initial);

    useEffect(() => {
        setOrders(initial);
    }, [initial]);

    useEffect(() => {
        let cancelled = false;

        function refresh() {
            if (document.hidden) {
                return;
            }

            listStaffOrders(view)
                .then((fresh) => {
                    if (!cancelled) {
                        setOrders(fresh);
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
    }, [view, intervalMs]);

    return [orders, setOrders];
}
