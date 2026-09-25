import {
    CookingPot,
    Images,
    KeyRound,
    Mail,
    ShieldCheck,
    LayoutDashboard,
    LogOut,
    ReceiptText,
    Users,
    UtensilsCrossed,
} from 'lucide-react';
import {
    Link,
    NavLink,
    Outlet,
    useLoaderData,
    useNavigate,
} from 'react-router';
import { logout, type staffLoader } from '@/lib/auth';
import { OrderCountsProvider, useOrderCounts } from '@/lib/order-counts';
import { cn } from '@/lib/utils';

/** Two letters for the badge: "Dan Madelo" becomes DM, "Nena" stays N. */
function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
}

/** How often the badges ask how much work is waiting. */
const COUNTS_MS = 15_000;

/**
 * A count on a nav item. Dahon for "there is this much here"; achuete when
 * something has just arrived and nobody has touched it, so the colour carries
 * one meaning only and the number carries the other.
 */
function Waiting({ count, urgent }: { count: number; urgent: boolean }) {
    if (count === 0) {
        return null;
    }

    return (
        <span
            className={cn(
                'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-bold tabular-nums',
                urgent ? 'bg-achuete text-white' : 'bg-dahon text-pandan',
            )}
        >
            {count > 99 ? '99+' : count}
        </span>
    );
}

/** The shape both footer actions take, so neither looks louder than the other. */
const actionClasses =
    'flex min-h-10 shrink-0 items-center justify-center gap-2.5 rounded-lg px-3 hover:bg-muted md:justify-start';

export default function AdminLayout() {
    const { user, abilities } = useLoaderData<typeof staffLoader>();
    const navigate = useNavigate();
    const { counts, recount } = useOrderCounts(COUNTS_MS);

    const links = [
        {
            to: '/admin',
            label: 'Dashboard',
            icon: LayoutDashboard,
            end: true,
            visible: abilities.view_reports,
            waiting: 0,
            urgent: false,
        },
        {
            to: '/admin/orders',
            label: 'Orders',
            icon: ReceiptText,
            end: false,
            visible: true,
            waiting: counts.queue,
            urgent: false,
        },
        {
            to: '/admin/kitchen',
            label: 'Kitchen',
            icon: CookingPot,
            end: false,
            visible: true,
            waiting: counts.kitchen,
            urgent: counts.kitchen_new > 0,
        },
        {
            to: '/admin/menu',
            label: 'Menu',
            waiting: 0,
            urgent: false,
            icon: UtensilsCrossed,
            end: false,
            visible: abilities.update_availability,
        },
        {
            to: '/admin/gallery',
            label: 'Gallery',
            waiting: 0,
            urgent: false,
            icon: Images,
            end: false,
            visible: abilities.manage_staff,
        },
        {
            to: '/admin/inquiries',
            label: 'Messages',
            waiting: 0,
            urgent: false,
            icon: Mail,
            end: false,
            visible: abilities.manage_staff,
        },
        {
            to: '/admin/staff',
            label: 'Staff',
            waiting: 0,
            urgent: false,
            icon: Users,
            end: false,
            visible: abilities.manage_staff,
        },
    ].filter((link) => link.visible);

    async function handleLogout() {
        await logout();
        await navigate('/login');
    }

    return (
        <div className="flex min-h-screen flex-col bg-background md:flex-row">
            <aside className="flex shrink-0 flex-col gap-6 border-b bg-card p-4 md:w-60 md:border-r md:border-b-0">
                <Link to="/admin" className="text-xl font-bold text-dahon">
                    Barrio Bistro
                </Link>
                <nav
                    className="-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain px-1 md:mx-0 md:flex-col md:overflow-visible md:px-0"
                    aria-label="Admin"
                >
                    {links.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            className={({ isActive }) =>
                                cn(
                                    'flex min-h-11 shrink-0 flex-col items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium hover:bg-muted md:flex-row md:justify-start md:gap-2 md:text-sm',
                                    isActive && 'bg-muted text-dahon',
                                )
                            }
                        >
                            <link.icon
                                aria-hidden="true"
                                className="size-5 md:size-4"
                            />

                            {/* The badge sits at the far end of the row on a
                                sidebar, and beside the label when the nav is
                                a strip of stacked icons on a phone. */}
                            <span className="inline-flex items-center gap-1.5 md:w-full md:justify-between md:gap-2">
                                {link.label}
                                <Waiting
                                    count={link.waiting}
                                    urgent={link.urgent}
                                />
                            </span>

                            {link.waiting > 0 && (
                                <span className="sr-only">
                                    , {link.waiting} waiting
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>
                <div className="flex items-center gap-2 border-t border-border pt-4 text-sm md:mt-auto md:flex-col md:items-stretch md:gap-1">
                    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-muted p-2.5 md:flex-none">
                        <span
                            aria-hidden="true"
                            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-dahon font-display text-xs font-bold text-pandan"
                        >
                            {initials(user.name)}
                        </span>
                        <div className="flex min-w-0 flex-col">
                            <p className="truncate font-semibold">
                                {user.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {user.role_label}
                            </p>
                        </div>
                    </div>

                    <Link
                        to="/account/two-factor"
                        aria-label="Two-step sign-in"
                        className={actionClasses}
                    >
                        <ShieldCheck
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="hidden md:inline">Two-step</span>
                    </Link>

                    <Link
                        to="/account/password"
                        aria-label="Change password"
                        className={actionClasses}
                    >
                        <KeyRound
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="hidden md:inline">
                            Change password
                        </span>
                    </Link>

                    <button
                        type="button"
                        aria-label="Log out"
                        onClick={() => void handleLogout()}
                        className={actionClasses}
                    >
                        <LogOut
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="hidden md:inline">Log out</span>
                    </button>
                </div>
            </aside>
            <main className="flex-1 p-6">
                {/* Anything in here that moves an order can ask the badges to
                    catch up, instead of waiting out the poll. */}
                <OrderCountsProvider value={recount}>
                    <Outlet />
                </OrderCountsProvider>
            </main>
        </div>
    );
}
