import { http } from '@/lib/http';
import type { CheckoutOptions, Order, Payment } from '@/types';

type Wrapped<T> = { data: T };

export async function fetchCheckoutOptions(): Promise<CheckoutOptions> {
    const response = await http.get<Wrapped<CheckoutOptions>>(
        '/api/v1/checkout/options',
    );

    return response.data;
}

/** Loader: what the cart may offer this guest. */
export function checkoutOptionsLoader(): Promise<CheckoutOptions> {
    return fetchCheckoutOptions();
}

/** Open a PayMongo checkout for an order and get the URL to send them to. */
export async function createCheckoutSession(token: string): Promise<Payment> {
    const response = await http.post<Wrapped<Payment>>(
        `/api/v1/orders/${token}/checkout-session`,
    );

    return response.data;
}

/** Ask our server to check with PayMongo how a payment ended. */
export async function refreshPayment(token: string): Promise<Order> {
    const response = await http.post<Wrapped<Order>>(
        `/api/v1/orders/${token}/payment/refresh`,
    );

    return response.data;
}

/** Whether this order may be paid online at all. */
export function canPayOnline(total: number, options: CheckoutOptions): boolean {
    return (
        options.methods.includes('online') && total >= options.online_minimum
    );
}
