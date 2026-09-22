import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router';
import { restaurant } from '@/content/restaurant';
import { cn } from '@/lib/utils';

const links = [
    { to: '/menu', label: 'Menu' },
    { to: '/#story', label: 'Story' },
    { to: '/#visit', label: 'Visit' },
];

export default function PublicLayout() {
    return (
        <div className="flex min-h-svh flex-col bg-pandan text-uling">
            <a
                href="#content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-uling focus:px-4 focus:py-2 focus:text-pandan"
            >
                Skip to content
            </a>

            <header className="bg-dahon text-pandan">
                <div className="wrapper flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
                    <Link
                        to="/"
                        className="font-display text-xl font-extrabold tracking-tight"
                    >
                        {restaurant.name}
                    </Link>
                    <nav aria-label="Main">
                        <ul className="flex gap-1">
                            {links.map((link) => (
                                <li key={link.to}>
                                    <NavLink
                                        to={link.to}
                                        className={({ isActive }) =>
                                            cn(
                                                'inline-flex min-h-11 items-center rounded-md px-3 font-medium underline-offset-4 hover:underline',
                                                isActive &&
                                                    link.to === '/menu' &&
                                                    'underline',
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
            </main>

            <footer className="border-t border-border">
                <div className="wrapper flex flex-wrap items-center justify-between gap-4 py-6 text-sm text-muted-foreground">
                    <p>
                        © {new Date().getFullYear()} {restaurant.name}
                    </p>
                    <Link to="/login" className="underline underline-offset-4">
                        Staff login
                    </Link>
                </div>
            </footer>

            <ScrollRestoration />
        </div>
    );
}
