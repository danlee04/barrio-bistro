import { XIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
    Link,
    useLoaderData,
    useNavigate,
    useRevalidator,
    useSearchParams,
} from 'react-router';
import { FormField } from '@/components/form-field';
import { PhotoField } from '@/components/menu/photo-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { HttpError, type ValidationErrors } from '@/lib/http';
import {
    createMenuItem,
    updateMenuItem,
    type MenuItemInput,
    type SizeInput,
    type menuItemFormLoader,
} from '@/lib/menu';
import { centavosToInput, parsePesoToCentavos } from '@/lib/money';
import type { Category, MenuItem, MenuItemSize } from '@/types';

type SizeRow = { key: string; id?: number; name: string; price: string };

let rowSequence = 0;

function newRow(size?: MenuItemSize, name = ''): SizeRow {
    rowSequence += 1;

    return {
        key: `size-${rowSequence}`,
        id: size?.id,
        name: size?.name ?? name,
        price: size ? centavosToInput(size.price) : '',
    };
}

export default function MenuItemFormPage() {
    const { categories, item } = useLoaderData<typeof menuItemFormLoader>();

    return (
        <MenuItemForm
            key={item?.id ?? 'new'}
            categories={categories}
            item={item}
        />
    );
}

function MenuItemForm({
    categories,
    item,
}: {
    categories: Category[];
    item: MenuItem | null;
}) {
    const navigate = useNavigate();
    const revalidator = useRevalidator();
    const [searchParams] = useSearchParams();
    const [name, setName] = useState(item?.name ?? '');
    const [categoryId, setCategoryId] = useState(
        item ? String(item.category_id) : '',
    );
    const [description, setDescription] = useState(item?.description ?? '');
    const [isFeatured, setIsFeatured] = useState(item?.is_featured ?? false);
    const [sizes, setSizes] = useState<SizeRow[]>(() =>
        item && item.sizes.length > 0
            ? item.sizes.map((size) => newRow(size))
            : [newRow(undefined, 'Regular')],
    );
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fieldError = (key: string): string | undefined => errors[key]?.[0];

    function updateRow(key: string, changes: Partial<SizeRow>) {
        setSizes((rows) =>
            rows.map((row) => (row.key === key ? { ...row, ...changes } : row)),
        );
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrors({});
        setFormError(null);

        const clientErrors: ValidationErrors = {};
        const parsedSizes: SizeInput[] = [];

        sizes.forEach((row, index) => {
            const price = parsePesoToCentavos(row.price);

            if (price === null) {
                clientErrors[`sizes.${index}.price`] = [
                    'Enter a price like 125 or 125.50.',
                ];
            } else {
                parsedSizes.push({
                    ...(row.id ? { id: row.id } : {}),
                    name: row.name,
                    price,
                });
            }
        });

        if (categoryId === '') {
            clientErrors.category_id = ['Choose a category.'];
        }

        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);

            return;
        }

        const payload: MenuItemInput = {
            category_id: Number(categoryId),
            name,
            description: description.trim() === '' ? null : description,
            is_featured: isFeatured,
            sizes: parsedSizes,
        };

        setIsSaving(true);

        try {
            if (item === null) {
                const created = await createMenuItem(payload);
                await navigate(
                    `/admin/menu/items/${created.data.id}/edit?created=1`,
                );
            } else {
                await updateMenuItem(item.id, payload);
                await navigate('/admin/menu');
            }
        } catch (error) {
            if (error instanceof HttpError && error.status === 422) {
                setErrors(error.errors);
            } else {
                setFormError(
                    error instanceof HttpError
                        ? error.message
                        : 'Could not reach the server. Try again.',
                );
            }
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
                <h1 className="font-display text-3xl font-extrabold">
                    {item === null ? 'Add item' : `Edit ${item.name}`}
                </h1>
                <Button asChild variant="outline">
                    <Link to="/admin/menu">Back to menu</Link>
                </Button>
            </div>

            {searchParams.get('created') === '1' && (
                <Alert>
                    <AlertDescription>
                        Saved. Add a photo below so it shows as a plate on the
                        menu.
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(event) => void handleSubmit(event)}
                        className="grid gap-5"
                    >
                        {formError && (
                            <Alert variant="destructive">
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        )}

                        <FormField
                            id="item-name"
                            label="Name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            error={fieldError('name')}
                            maxLength={80}
                            required
                        />

                        <div className="grid gap-2">
                            <Label htmlFor="item-category">Category</Label>
                            <Select
                                value={categoryId}
                                onValueChange={setCategoryId}
                            >
                                <SelectTrigger
                                    id="item-category"
                                    aria-invalid={
                                        fieldError('category_id')
                                            ? true
                                            : undefined
                                    }
                                >
                                    <SelectValue placeholder="Choose a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem
                                            key={category.id}
                                            value={String(category.id)}
                                        >
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldError('category_id') && (
                                <p className="text-sm text-destructive">
                                    {fieldError('category_id')}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="item-description">
                                Description
                            </Label>
                            <Textarea
                                id="item-description"
                                value={description}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                                maxLength={500}
                                rows={3}
                                aria-invalid={
                                    fieldError('description') ? true : undefined
                                }
                            />
                            {fieldError('description') && (
                                <p className="text-sm text-destructive">
                                    {fieldError('description')}
                                </p>
                            )}
                        </div>

                        <fieldset className="grid gap-3">
                            <legend className="text-sm font-medium">
                                Sizes and prices
                            </legend>
                            <p className="text-sm text-muted-foreground">
                                Keep one row if the item has a single price.
                            </p>
                            {sizes.map((row, index) => (
                                <div
                                    key={row.key}
                                    className="grid grid-cols-[1fr_8rem_auto] items-start gap-2"
                                >
                                    <div className="grid gap-1">
                                        <Input
                                            aria-label={`Size ${index + 1} name`}
                                            placeholder="Regular"
                                            value={row.name}
                                            onChange={(event) =>
                                                updateRow(row.key, {
                                                    name: event.target.value,
                                                })
                                            }
                                            maxLength={40}
                                            required
                                            aria-invalid={
                                                fieldError(
                                                    `sizes.${index}.name`,
                                                )
                                                    ? true
                                                    : undefined
                                            }
                                        />
                                        {fieldError(`sizes.${index}.name`) && (
                                            <p className="text-sm text-destructive">
                                                {fieldError(
                                                    `sizes.${index}.name`,
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-1">
                                        <Input
                                            aria-label={`Size ${index + 1} price in pesos`}
                                            inputMode="decimal"
                                            placeholder="125.00"
                                            value={row.price}
                                            onChange={(event) =>
                                                updateRow(row.key, {
                                                    price: event.target.value,
                                                })
                                            }
                                            required
                                            aria-invalid={
                                                fieldError(
                                                    `sizes.${index}.price`,
                                                )
                                                    ? true
                                                    : undefined
                                            }
                                        />
                                        {fieldError(`sizes.${index}.price`) && (
                                            <p className="text-sm text-destructive">
                                                {fieldError(
                                                    `sizes.${index}.price`,
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Remove size ${index + 1}`}
                                        disabled={sizes.length === 1}
                                        onClick={() =>
                                            setSizes((rows) =>
                                                rows.filter(
                                                    (candidate) =>
                                                        candidate.key !==
                                                        row.key,
                                                ),
                                            )
                                        }
                                    >
                                        <XIcon />
                                    </Button>
                                </div>
                            ))}
                            {fieldError('sizes') && (
                                <p className="text-sm text-destructive">
                                    {fieldError('sizes')}
                                </p>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-fit"
                                disabled={sizes.length >= 6}
                                onClick={() =>
                                    setSizes((rows) => [...rows, newRow()])
                                }
                            >
                                Add size
                            </Button>
                        </fieldset>

                        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                            <Label htmlFor="item-featured">
                                Featured in the "Nasa kalan" hero
                            </Label>
                            <Switch
                                id="item-featured"
                                checked={isFeatured}
                                onCheckedChange={setIsFeatured}
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-fit"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving…' : 'Save item'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {item !== null && (
                <PhotoField
                    item={item}
                    onChanged={() => void revalidator.revalidate()}
                />
            )}
        </div>
    );
}
