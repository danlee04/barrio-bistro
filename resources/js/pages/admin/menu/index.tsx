import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';
import {
    Link,
    useLoaderData,
    useRevalidator,
    useRouteLoaderData,
} from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AvailabilitySwitch } from '@/components/menu/availability-switch';
import { PlateThumb } from '@/components/menu/plate-thumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { staffLoader } from '@/lib/auth';
import {
    archiveMenuItem,
    moveMenuItem,
    type Direction,
    type menuBoardLoader,
} from '@/lib/menu';
import { formatPeso } from '@/lib/money';
import type { MenuItem } from '@/types';

export default function MenuBoard() {
    const categories = useLoaderData<typeof menuBoardLoader>();
    const current = useRouteLoaderData<typeof staffLoader>('admin');
    const canManage = current?.abilities.manage_menu ?? false;
    const revalidator = useRevalidator();
    const [archiving, setArchiving] = useState<MenuItem | null>(null);
    const [moveError, setMoveError] = useState<string | null>(null);

    const refresh = () => void revalidator.revalidate();

    async function handleMove(item: MenuItem, direction: Direction) {
        setMoveError(null);

        try {
            await moveMenuItem(item.id, direction);
            refresh();
        } catch {
            setMoveError('Could not reorder. Try again.');
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Menu</h1>
                    <p className="text-sm text-muted-foreground">
                        {canManage
                            ? 'Manage dishes, prices and what is sold out.'
                            : 'Mark dishes "Ubos na" when they run out, and available again when they are back.'}
                    </p>
                </div>
                {canManage && (
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link to="/admin/menu/categories">Categories</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link to="/admin/menu/archived">Archived</Link>
                        </Button>
                        <Button asChild>
                            <Link to="/admin/menu/items/new">Add item</Link>
                        </Button>
                    </div>
                )}
            </div>

            {moveError && (
                <Alert variant="destructive">
                    <AlertDescription>{moveError}</AlertDescription>
                </Alert>
            )}

            {categories.length === 0 && (
                <p className="text-muted-foreground">
                    No menu items yet.
                    {canManage &&
                        ' Add a category first, then add items to it.'}
                </p>
            )}

            {categories.map((category) => (
                <section
                    key={category.id}
                    aria-labelledby={`category-${category.id}`}
                    className="flex flex-col gap-3"
                >
                    <h2
                        id={`category-${category.id}`}
                        className="text-xl font-bold"
                    >
                        {category.name}
                    </h2>
                    <ul className="divide-y rounded-lg border bg-card">
                        {category.items.map((item, index) => (
                            <li
                                key={item.id}
                                className="flex flex-wrap items-center gap-4 p-3"
                            >
                                <PlateThumb item={item} />
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">
                                        {item.name}
                                        {item.is_featured && (
                                            <Badge className="ml-2 bg-achuete text-white">
                                                Featured
                                            </Badge>
                                        )}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.sizes
                                            .map(
                                                (size) =>
                                                    `${size.name} ${formatPeso(size.price)}`,
                                            )
                                            .join(' · ')}
                                    </p>
                                </div>
                                <AvailabilitySwitch
                                    item={item}
                                    onChanged={refresh}
                                />
                                {canManage && (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label={`Move ${item.name} up`}
                                            disabled={index === 0}
                                            onClick={() =>
                                                void handleMove(item, 'up')
                                            }
                                        >
                                            <ChevronUpIcon />
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label={`Move ${item.name} down`}
                                            disabled={
                                                index ===
                                                category.items.length - 1
                                            }
                                            onClick={() =>
                                                void handleMove(item, 'down')
                                            }
                                        >
                                            <ChevronDownIcon />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            asChild
                                        >
                                            <Link
                                                to={`/admin/menu/items/${item.id}/edit`}
                                            >
                                                Edit
                                            </Link>
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setArchiving(item)}
                                        >
                                            Archive
                                        </Button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            {archiving && (
                <ConfirmDialog
                    title={`Archive ${archiving.name}?`}
                    description="It disappears from the menu but stays in order history. You can restore it from Archived."
                    confirmLabel="Archive"
                    onConfirm={async () => {
                        await archiveMenuItem(archiving.id);
                        refresh();
                    }}
                    onClose={() => setArchiving(null)}
                />
            )}
        </div>
    );
}
