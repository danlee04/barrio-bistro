import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router';
import { RecentOrderLink } from '@/components/cart/recent-order-link';
import { OpenStatus } from '@/components/public/open-status';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import { cn } from '@/lib/utils';

const links = [
    { to: '/menu', label: 'Menu' },
    { to: '/gallery', label: 'Gallery' },
    { to: '/offers', label: 'Offers' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
];

/** The same shape as a nav link, for the one that jumps to a section. */
const linkClasses =
    'relative inline-flex min-h-11 items-center rounded-full px-4 font-medium text-pandan/90 transition-colors hover:bg-pandan/15 hover:text-pandan';

/** The link for the page you are already on: lit, like a pressed key. */
const activeClasses =
    'bg-pandan text-dahon shadow-sm hover:bg-pandan hover:text-dahon';

/** How far the page must move before the navigation turns to glass. */
const GLASS_AT = 8;

/** The website a visitor reads. The cart lives in the till, not here. */
export default function MarketingLayout() {
    const [stuck, setStuck] = useState(false);
    const header = useRef<HTMLElement>(null);

    // The bar floats over the page, so anything else that sticks needs to know
    // how tall it is. It wraps to two rows on a narrow screen, so it is
    // measured rather than guessed.
    useEffect(() => {
        const bar = header.current;

        if (bar === null) {
            return;
        }

        function measure() {
            document.documentElement.style.setProperty(
                '--header-h',
                `${bar.offsetHeight}px`,
            );
        }

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(bar);

        return () => observer.disconnect();
    }, []);

    // At rest the bar is the hero's own green; it frosts once the page slides
    // under it, so there is something worth seeing through.
    useEffect(() => {
        function onScroll() {
            setStuck(window.scrollY > GLASS_AT);
        }

        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <div className="flex min-h-svh flex-col bg-pandan text-uling">
            <a
                href="#content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-uling focus:px-4 focus:py-2 focus:text-pandan"
            >
                Skip to content
            </a>

            <header
                ref={header}
                data-stuck={stuck}
                className="nav-glass sticky top-0 z-40 text-pandan"
            >
                <div className="wrapper flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 py-3 md:grid md:grid-cols-[auto_1fr_auto]">
                    <Link
                        to="/"
                        className="font-display text-xl font-bold tracking-tight"
                    >
                        {restaurant.name}
                    </Link>

                    <div className="ml-auto flex items-center gap-2 md:order-3 md:ml-0 md:justify-self-end">
                        <RecentOrderLink />
                        <Button
                            asChild
                            className="min-h-11 rounded-full px-5 text-base"
                        >
                            <Link to="/order">Order now</Link>
                        </Button>
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
                                                linkClasses,
                                                isActive && activeClasses,
                                            )
                                        }
                                    >
                                        {link.label}
                                    </NavLink>
                                </li>
                            ))}

                            <li className="shrink-0">
                                <Link
                                    to="/#testimonials"
                                    className={linkClasses}
                                >
                                    Reviews
                                </Link>
                            </li>
                        </ul>
                    </nav>
                </div>
            </header>

            <main id="content" className="flex-1">
                <Outlet />
            </main>

            <footer className="border-t border-border bg-card">
                <div className="wrapper grid gap-8 py-10 md:grid-cols-3">
                    <div className="flex flex-col gap-2">
                        <p className="font-display text-lg font-bold">
                            {restaurant.name}
                        </p>
                        <OpenStatus className="text-sm" />
                        <Link
                            to="/order"
                            className="text-sm underline underline-offset-4"
                        >
                            Order now
                        </Link>
                    </div>

                    <div className="flex flex-col gap-2 text-sm">
                        <p className="font-semibold">Find us</p>
                        <address className="leading-relaxed text-muted-foreground not-italic">
                            {restaurant.addressLines.map((line) => (
                                <span key={line} className="block">
                                    {line}
                                </span>
                            ))}
                        </address>
                        <a
                            href={`tel:${restaurant.phone.tel}`}
                            className="underline underline-offset-4"
                        >
                            {restaurant.phone.display}
                        </a>
                    </div>

                    <div className="flex flex-col gap-2 text-sm">
                        <p className="font-semibold">More</p>
                        <Link
                            to="/menu"
                            className="underline underline-offset-4"
                        >
                            Menu
                        </Link>
                        <Link
                            to="/gallery"
                            className="underline underline-offset-4"
                        >
                            Gallery
                        </Link>
                        <Link
                            to="/offers"
                            className="underline underline-offset-4"
                        >
                            Bulk orders
                        </Link>
                        <Link
                            to="/about"
                            className="underline underline-offset-4"
                        >
                            About
                        </Link>
                        <Link
                            to="/contact"
                            className="underline underline-offset-4"
                        >
                            Contact
                        </Link>
                        <Link
                            to="/login"
                            className="underline underline-offset-4"
                        >
                            Staff login
                        </Link>
                    </div>
                </div>

                <div className="wrapper border-t border-border py-4 text-sm text-muted-foreground">
                    © {new Date().getFullYear()} {restaurant.name}
                </div>
            </footer>

            <ScrollRestoration />
        </div>
    );
}
