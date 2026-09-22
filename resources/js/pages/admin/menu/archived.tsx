import { useState } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';
import { PlateThumb } from '@/components/menu/plate-thumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { HttpError } from '@/lib/http';
import { restoreMenuItem, type archivedItemsLoader } from '@/lib/menu';

const archivedFormat = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
});

export default function ArchivedItems() {
    const items = useLoaderData<typeof archivedItemsLoader>();
    const revalidator = useRevalidator();
    const [error, setError] = useState<string | null>(null);

    async function handleRestore(id: number) {
        setError(null);

        try {
            await restoreMenuItem(id);
            void revalidator.revalidate();
        } catch (caught) {
            setError(
                caught instanceof HttpError
                    ? caught.message
                    : 'Could not reach the server. Try again.',
            );
        }
    }

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="font-display text-3xl font-extrabold">
                    Archived items
                </h1>
                <Button asChild variant="outline">
                    <Link to="/admin/menu">Back to menu</Link>
                </Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {items.length === 0 ? (
                <p className="text-muted-foreground">Nothing is archived.</p>
            ) : (
                <ul className="divide-y rounded-lg border bg-card">
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className="flex flex-wrap items-center gap-4 p-3"
                        >
                            <PlateThumb item={item} />
                            <div className="min-w-0 flex-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {item.category_name}
                                    {item.archived_at &&
                                        ` · archived ${archivedFormat.format(new Date(item.archived_at))}`}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleRestore(item.id)}
                            >
                                Restore
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
