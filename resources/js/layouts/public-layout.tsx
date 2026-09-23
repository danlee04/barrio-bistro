import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router';
import { CartProvider } from '@/components/cart/cart-provider';
import { CartDock } from '@/components/cart/cart-dock';
import { RecentOrderLink } from '@/components/cart/recent-order-link';
import { restaurant } from '@/content/restaurant';
import { cn } from '@/lib/utils';

const links = [
    { to: '/menu', label: 'Menu' },
    { to: '/#story', label: 'Story' },
    { to: '/#visit', label: 'Visit' },
];

export default function PublicLayout() {
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
                    <div className="wrapper flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 py-3 md:grid md:grid-cols-[auto_1fr_auto]">
                        <Link
                            to="/"
                            className="font-display text-xl font-bold tracking-tight"
                        >
                            {restaurant.name}
                        </Link>

                        <div className="ml-auto md:order-3 md:ml-0 md:justify-self-end">
                            <RecentOrderLink />
                        </div>

                        <nav
                            aria-label="Main"
                            className="w-full md:order-2 md:w-auto md:justify-self-center"
                        >
                            <ul className="flex gap-1 overflow-x-auto overscroll-x-contain">
                                {links.map((link) => (
                                    <li key={link.to} className="shrink-0">
                                        <NavLink
                                            to={link.to}
                                            className={({ isActive }) =>
                                                cn(
                                                    'inline-flex min-h-11 items-center rounded-full px-3 font-medium hover:bg-pandan/15',
                                                    isActive &&
                                                        link.to === '/menu' &&
                                                        'bg-pandan/15',
                                                )
                                            }
                                        >
                                            {link.label}
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </div>
                </header>

                <main id="content" className="flex-1">
                    <Outlet />
                    <CartDock />
                </main>

                <footer className="border-t border-border">
                    <div className="wrapper flex flex-wrap items-center justify-between gap-4 py-6 text-sm text-muted-foreground">
                        <p>
                            © {new Date().getFullYear()} {restaurant.name}
                        </p>
                        <Link
                            to="/login"
                            className="underline underline-offset-4"
                        >
                            Staff login
                        </Link>
                    </div>
                </footer>

                <ScrollRestoration />
            </div>
        </CartProvider>
    );
}
