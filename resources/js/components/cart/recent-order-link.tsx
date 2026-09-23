import { ReceiptText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { recentOrder } from '@/lib/orders';

/** A way back to the order the guest placed, for as long as it is theirs. */
export function RecentOrderLink() {
    const { pathname } = useLocation();
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        setToken(recentOrder());
    }, [pathname]);

    if (token === null || pathname.startsWith('/order/')) {
        return null;
    }

    return (
        <Link
            to={`/order/${token}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-medium hover:bg-pandan/15"
        >
            <ReceiptText aria-hidden="true" className="size-5" />
            Your order
        </Link>
    );
}
