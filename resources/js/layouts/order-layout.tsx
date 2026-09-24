import { useState } from 'react';
import { Link, Outlet, ScrollRestoration } from 'react-router';
import { CartDock } from '@/components/cart/cart-dock';
import { CartProvider } from '@/components/cart/cart-provider';
import { IdleWatch } from '@/components/kiosk/idle-watch';
import { restaurant } from '@/content/restaurant';
import { isKiosk } from '@/lib/kiosk';

/**
 * The till. Deliberately bare: the shop's name, the order in the corner, and
 * nothing that invites wandering off mid-order. On the counter tablet even the
 * way back to the website is gone.
 */
export default function OrderLayout() {
    const [kiosk] = useState(() => isKiosk());

    return (
        <CartProvider>
            <div className="flex min-h-svh flex-col bg-pandan text-uling">
                <a
                    href="#content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-uling focus:px-4 focus:py-2 focus:text-pandan"
                >
                    Skip to content
                </a>

                <header className="bg-dahon text-pandan">
                    <div className="wrapper flex min-h-16 items-center justify-between gap-4 py-3">
                        {kiosk ? (
                            <p className="font-display text-xl font-bold tracking-tight">
                                {restaurant.name}
                            </p>
                        ) : (
                            <Link
                                to="/"
                                className="-mx-3 inline-flex min-h-11 items-center rounded-full px-3 font-display text-xl font-bold tracking-tight transition-colors hover:bg-pandan/15"
                            >
                                {restaurant.name}
                            </Link>
                        )}

                        <p className="text-sm text-pandan/70">Order here</p>
                    </div>
                </header>

                <main id="content" className="flex-1">
                    <Outlet />
                    <CartDock />
                </main>

                <footer className="border-t border-border">
                    <div className="wrapper flex flex-wrap items-center justify-between gap-4 py-5 text-sm text-muted-foreground">
                        <p>
                            Pay at the counter, or online with GCash or a card.
                        </p>
                        {!kiosk && (
                            <Link
                                to="/menu"
                                className="underline underline-offset-4"
                            >
                                Back to the website
                            </Link>
                        )}
                    </div>
                </footer>

                <IdleWatch />
                <ScrollRestoration />
            </div>
        </CartProvider>
    );
}
