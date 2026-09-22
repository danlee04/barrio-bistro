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
        { to: '/admin', label: 'Dashboard', end: true, visible: true },
        {
            to: '/admin/menu',
            label: 'Menu',
            end: false,
            visible: abilities.update_availability,
        },
        {
            to: '/admin/staff',
            label: 'Staff',
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
                <Link
                    to="/admin"
                    className="font-display text-xl font-extrabold text-dahon"
                >
                    Barrio Bistro
                </Link>
                <nav className="flex gap-1 md:flex-col" aria-label="Admin">
                    {links.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            className={({ isActive }) =>
                                cn(
                                    'rounded-md px-3 py-2 text-sm font-medium hover:bg-muted',
                                    isActive && 'bg-muted text-dahon',
                                )
                            }
                        >
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
                    <Link to="/account/password" className="underline">
                        Change password
                    </Link>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleLogout()}
                    >
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
