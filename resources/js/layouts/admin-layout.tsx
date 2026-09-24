import {
    CookingPot,
    Images,
    KeyRound,
    Mail,
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
import { Button } from '@/components/ui/button';
import { logout, type staffLoader } from '@/lib/auth';
import { cn } from '@/lib/utils';

export default function AdminLayout() {
    const { user, abilities } = useLoaderData<typeof staffLoader>();
    const navigate = useNavigate();

    const links = [
        {
            to: '/admin',
            label: 'Dashboard',
            icon: LayoutDashboard,
            end: true,
            visible: true,
        },
        {
            to: '/admin/orders',
            label: 'Orders',
            icon: ReceiptText,
            end: false,
            visible: true,
        },
        {
            to: '/admin/kitchen',
            label: 'Kitchen',
            icon: CookingPot,
            end: false,
            visible: true,
        },
        {
            to: '/admin/menu',
            label: 'Menu',
            icon: UtensilsCrossed,
            end: false,
            visible: abilities.update_availability,
        },
        {
            to: '/admin/gallery',
            label: 'Gallery',
            icon: Images,
            end: false,
            visible: abilities.manage_staff,
        },
        {
            to: '/admin/inquiries',
            label: 'Messages',
            icon: Mail,
            end: false,
            visible: abilities.manage_staff,
        },
        {
            to: '/admin/staff',
            label: 'Staff',
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
                            {link.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="flex flex-col gap-2 text-sm md:mt-auto">
                    <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-muted-foreground">
                            {user.role_label}
                        </p>
                    </div>
                    <Link
                        to="/account/password"
                        className="flex items-center gap-2 underline underline-offset-4"
                    >
                        <KeyRound aria-hidden="true" className="size-4" />
                        Change password
                    </Link>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleLogout()}
                    >
                        <LogOut aria-hidden="true" />
                        Log out
                    </Button>
                </div>
            </aside>
            <main className="flex-1 p-6">
                <Outlet />
            </main>
        </div>
    );
}
