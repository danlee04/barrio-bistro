import { Link, useLocation, useRouteLoaderData } from 'react-router';
import { priceCart } from '@/lib/cart';
import { useCart } from '@/lib/cart-context';
import { formatPeso } from '@/lib/money';
import type { publicMenuLoader } from '@/lib/public-menu';

/** The running order, always one tap away from checkout. */
export function OrderBar() {
    const { cart } = useCart();
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('public') ?? [];
    const { pathname } = useLocation();
    const { lines, subtotal } = priceCart(cart, categories);
    const count = lines.reduce(
        (total, priced) => total + priced.line.quantity,
        0,
    );

    if (count === 0 || pathname === '/cart') {
        return null;
    }

    return (
        <>
            <div aria-hidden="true" className="h-24" />

            <div className="fixed inset-x-0 bottom-0 z-20 bg-dahon text-pandan">
                <div className="wrapper flex items-center justify-between gap-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <p aria-live="polite" className="font-medium">
                        {count} {count === 1 ? 'item' : 'items'} ·{' '}
                        <span className="font-display font-extrabold">
                            {formatPeso(subtotal)}
                        </span>
                    </p>

                    <Link
                        to="/cart"
                        className="inline-flex min-h-11 items-center rounded-full bg-achuete px-5 font-semibold text-white"
                    >
                        Review order
                    </Link>
                </div>
            </div>
        </>
    );
}
