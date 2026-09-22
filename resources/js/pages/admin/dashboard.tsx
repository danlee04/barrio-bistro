import { useRouteLoaderData } from 'react-router';
import type { staffLoader } from '@/lib/auth';

export default function Dashboard() {
    const current = useRouteLoaderData<typeof staffLoader>('admin');

    return (
        <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-extrabold">
                Magandang araw, {current?.user.name}!
            </h1>
            <p className="text-muted-foreground">
                Orders and reports will appear here in the next modules.
            </p>
        </div>
    );
}
