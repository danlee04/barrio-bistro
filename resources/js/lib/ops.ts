import { http } from '@/lib/http';
import type { OpsView, OrderStatus, StaffOrder } from '@/types';

type Wrapped<T> = { data: T };

export async function listStaffOrders(view: OpsView): Promise<StaffOrder[]> {
    const response = await http.get<Wrapped<StaffOrder[]>>(
        `/api/v1/staff/orders?view=${view}`,
    );

    return response.data;
}

export async function updateOrderStatus(
    token: string,
    status: OrderStatus,
    reason?: string,
): Promise<StaffOrder> {
    const response = await http.patch<Wrapped<StaffOrder>>(
        `/api/v1/orders/${token}/status`,
        reason === undefined ? { status } : { status, reason },
    );

    return response.data;
}

export async function markOrderPaid(token: string): Promise<StaffOrder> {
    const response = await http.post<Wrapped<StaffOrder>>(
        `/api/v1/orders/${token}/mark-paid`,
    );

    return response.data;
}

export const queueLoader = () => listStaffOrders('queue');
export const kitchenLoader = () => listStaffOrders('kitchen');

/** How long an order has been waiting, said the way the counter says it. */
export function elapsedLabel(iso: string | null, now = Date.now()): string {
    if (iso === null) {
        return '';
    }

    const minutes = Math.floor((now - Date.parse(iso)) / 60_000);

    if (!Number.isFinite(minutes) || minutes < 1) {
        return 'just now';
    }

    if (minutes < 60) {
        return `${minutes}m`;
    }

    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Which orders appeared since the last look — what the chime is for. */
export function newTokens(previous: string[], next: string[]): string[] {
    const seen = new Set(previous);

    return next.filter((token) => !seen.has(token));
}
