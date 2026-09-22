import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CategoryFormDialog } from '@/components/menu/category-form-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { HttpError } from '@/lib/http';
import {
    archiveCategory,
    moveCategory,
    restoreCategory,
    type categoriesLoader,
} from '@/lib/menu';
import type { Category } from '@/types';

export default function Categories() {
    const { active, archived } = useLoaderData<typeof categoriesLoader>();
    const revalidator = useRevalidator();
    const [isCreating, setIsCreating] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);
    const [archiving, setArchiving] = useState<Category | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const refresh = () => void revalidator.revalidate();

    async function run(action: () => Promise<unknown>) {
        setActionError(null);

        try {
            await action();
            refresh();
        } catch (error) {
            setActionError(
                error instanceof HttpError
                    ? error.message
                    : 'Could not reach the server. Try again.',
            );
        }
    }

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="font-display text-3xl font-extrabold">
                    Categories
                </h1>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link to="/admin/menu">Back to menu</Link>
                    </Button>
                    <Button onClick={() => setIsCreating(true)}>
                        Add category
                    </Button>
                </div>
            </div>

            {actionError && (
                <Alert variant="destructive">
                    <AlertDescription>{actionError}</AlertDescription>
                </Alert>
            )}

            <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {active.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={3}
                                    className="py-8 text-center text-muted-foreground"
                                >
                                    No categories yet. Add Meals, Snacks,
                                    Drinks…
                                </TableCell>
                            </TableRow>
                        )}
                        {active.map((category, index) => (
                            <TableRow key={category.id}>
                                <TableCell className="font-medium">
                                    {category.name}
                                </TableCell>
                                <TableCell>
                                    {category.items_count ?? 0}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label={`Move ${category.name} up`}
                                            disabled={index === 0}
                                            onClick={() =>
                                                void run(() =>
                                                    moveCategory(
                                                        category.id,
                                                        'up',
                                                    ),
                                                )
                                            }
                                        >
                                            <ChevronUpIcon />
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label={`Move ${category.name} down`}
                                            disabled={
                                                index === active.length - 1
                                            }
                                            onClick={() =>
                                                void run(() =>
                                                    moveCategory(
                                                        category.id,
                                                        'down',
                                                    ),
                                                )
                                            }
                                        >
                                            <ChevronDownIcon />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditing(category)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                setArchiving(category)
                                            }
                                        >
                                            Archive
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {archived.length > 0 && (
                <section
                    className="flex flex-col gap-3"
                    aria-labelledby="archived-categories"
                >
                    <h2
                        id="archived-categories"
                        className="font-display text-xl font-extrabold"
                    >
                        Archived
                    </h2>
                    <ul className="divide-y rounded-lg border bg-card">
                        {archived.map((category) => (
                            <li
                                key={category.id}
                                className="flex items-center justify-between gap-4 p-3"
                            >
                                <span>{category.name}</span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        void run(() =>
                                            restoreCategory(category.id),
                                        )
                                    }
                                >
                                    Restore
                                </Button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {isCreating && (
                <CategoryFormDialog
                    category={null}
                    onClose={() => setIsCreating(false)}
                    onSaved={refresh}
                />
            )}
            {editing && (
                <CategoryFormDialog
                    key={editing.id}
                    category={editing}
                    onClose={() => setEditing(null)}
                    onSaved={refresh}
                />
            )}
            {archiving && (
                <ConfirmDialog
                    title={`Archive ${archiving.name}?`}
                    description="The category and all of its items disappear from the menu. Nothing is deleted, so you can restore it later."
                    confirmLabel="Archive"
                    onConfirm={async () => {
                        await archiveCategory(archiving.id);
                        refresh();
                    }}
                    onClose={() => setArchiving(null)}
                />
            )}
        </div>
    );
}
