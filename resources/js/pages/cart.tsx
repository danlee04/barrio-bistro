import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useRouteLoaderData } from 'react-router';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { Plate } from '@/components/public/plate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { restaurant } from '@/content/restaurant';
import { MAX_NOTE, priceCart } from '@/lib/cart';
import { useCart } from '@/lib/cart-context';
import { HttpError, type ValidationErrors } from '@/lib/http';
import { formatPeso } from '@/lib/money';
import { placeOrder, rememberOrder } from '@/lib/orders';
import type { publicMenuLoader } from '@/lib/public-menu';
import { cn } from '@/lib/utils';
import type { OrderType } from '@/types';

export default function Cart() {
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('public') ?? [];
    const { cart, setQuantity, setNote, remove, setTable, clear } = useCart();
    const navigate = useNavigate();

    const [type, setType] = useState<OrderType>('dine_in');
    const [name, setName] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [message, setMessage] = useState<string | null>(null);
    const [placing, setPlacing] = useState(false);

    const { lines, subtotal, soldOut } = priceCart(cart, categories);
    const error = (field: string) => errors[field]?.[0];

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrors({});
        setMessage(null);
        setPlacing(true);

        try {
            const order = await placeOrder({
                type,
                table_number: type === 'dine_in' ? cart.table : null,
                customer_name: type === 'takeout' ? name.trim() : null,
                payment_method: 'counter',
                items: lines.map(({ line }) => ({
                    menu_item_id: line.itemId,
                    menu_item_size_id: line.sizeId,
                    quantity: line.quantity,
                    note: line.note.trim() === '' ? null : line.note.trim(),
                })),
            });

            rememberOrder(order.token);
            clear();
            void navigate(`/order/${order.token}`);
        } catch (failure) {
            if (failure instanceof HttpError) {
                setErrors(failure.errors);
                setMessage(
                    failure.status === 429
                        ? 'That is a lot of orders in one minute. Please wait a moment and try again.'
                        : (failure.body.message ??
                              'We could not place your order. Please try again.'),
                );
            } else {
                setMessage(
                    'We could not reach the kitchen. Check your connection and try again.',
                );
            }

            setPlacing(false);
        }
    }

    if (lines.length === 0) {
        return (
            <>
                <title>{`Your order | ${restaurant.name}`}</title>

                <div className="wrapper flex flex-col items-start gap-4 py-20">
                    <h1 className="font-display text-4xl font-extrabold tracking-tight">
                        Your order is empty.
                    </h1>
                    <p className="text-lg">Pick something from today's menu.</p>
                    <Link
                        to="/menu"
                        className="text-lg underline underline-offset-4"
                    >
                        See the menu
                    </Link>
                </div>
            </>
        );
    }

    return (
        <>
            <title>{`Your order | ${restaurant.name}`}</title>

            <form
                onSubmit={handleSubmit}
                className="wrapper flex flex-col gap-8 py-10"
            >
                <h1 className="font-display text-4xl font-extrabold tracking-tight">
                    Your order
                </h1>

                <ul className="flex flex-col divide-y divide-border">
                    {lines.map(({ line, item, size, lineTotal }, index) => (
                        <li
                            key={line.sizeId}
                            className="flex flex-col gap-3 py-5"
                        >
                            <div className="flex items-start gap-4">
                                <Plate item={item} size="menu" />

                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <h2 className="text-lg font-semibold">
                                        {item.name}
                                    </h2>
                                    <p className="text-muted-foreground">
                                        {item.sizes.length > 1 &&
                                            `${size.name} · `}
                                        {formatPeso(size.price)} each
                                    </p>

                                    {!item.is_available && (
                                        <p className="font-semibold text-achuete">
                                            Sold out today — remove it to carry
                                            on.
                                        </p>
                                    )}

                                    {error(
                                        `items.${index}.menu_item_size_id`,
                                    ) && (
                                        <p className="font-semibold text-destructive">
                                            {error(
                                                `items.${index}.menu_item_size_id`,
                                            )}
                                        </p>
                                    )}
                                </div>

                                <p className="font-display text-lg font-extrabold">
                                    {formatPeso(lineTotal)}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <QuantityStepper
                                    value={line.quantity}
                                    label={item.name}
                                    onChange={(quantity) =>
                                        setQuantity(line.sizeId, quantity)
                                    }
                                />

                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="min-h-11"
                                    onClick={() => remove(line.sizeId)}
                                >
                                    Remove
                                </Button>
                            </div>

                            <div className="grid gap-2">
                                <Label
                                    htmlFor={`note-${line.sizeId}`}
                                    className="sr-only"
                                >
                                    {`Note for ${item.name}`}
                                </Label>
                                <Input
                                    id={`note-${line.sizeId}`}
                                    value={line.note}
                                    maxLength={MAX_NOTE}
                                    placeholder="Note for the kitchen (optional)"
                                    onChange={(event) =>
                                        setNote(line.sizeId, event.target.value)
                                    }
                                />
                            </div>
                        </li>
                    ))}
                </ul>

                <fieldset className="flex flex-col gap-3">
                    <legend className="mb-2 font-display text-xl font-extrabold">
                        Where are you eating?
                    </legend>

                    <div role="group" className="grid grid-cols-2 gap-3">
                        {(['dine_in', 'takeout'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                aria-pressed={type === option}
                                onClick={() => setType(option)}
                                className={cn(
                                    'min-h-14 rounded-xl border-2 px-4 font-semibold',
                                    type === option
                                        ? 'border-dahon bg-dahon text-pandan'
                                        : 'border-border bg-card',
                                )}
                            >
                                {option === 'dine_in' ? 'Dine in' : 'Take out'}
                            </button>
                        ))}
                    </div>

                    {type === 'dine_in' ? (
                        <div className="grid gap-2">
                            <Label htmlFor="table">Table number</Label>
                            <Input
                                id="table"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={cart.table ?? ''}
                                aria-invalid={
                                    error('table_number') ? true : undefined
                                }
                                aria-describedby={
                                    error('table_number')
                                        ? 'table-error'
                                        : 'table-hint'
                                }
                                onChange={(event) => {
                                    const value = event.target.value.trim();

                                    setTable(
                                        value === ''
                                            ? null
                                            : Number.parseInt(value, 10),
                                    );
                                }}
                            />
                            {error('table_number') ? (
                                <p
                                    id="table-error"
                                    className="text-sm text-destructive"
                                >
                                    {error('table_number')}
                                </p>
                            ) : (
                                <p
                                    id="table-hint"
                                    className="text-sm text-muted-foreground"
                                >
                                    It is printed on the QR card on your table.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                maxLength={40}
                                autoComplete="given-name"
                                aria-invalid={
                                    error('customer_name') ? true : undefined
                                }
                                aria-describedby={
                                    error('customer_name')
                                        ? 'name-error'
                                        : undefined
                                }
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                            />
                            {error('customer_name') && (
                                <p
                                    id="name-error"
                                    className="text-sm text-destructive"
                                >
                                    {error('customer_name')}
                                </p>
                            )}
                        </div>
                    )}
                </fieldset>

                <div className="rounded-xl border-2 border-dahon bg-card p-4">
                    <p className="font-display text-xl font-extrabold">
                        Pay at the counter
                    </p>
                    <p className="text-muted-foreground">
                        Place the order, then pay at the counter. The kitchen
                        starts once it is paid.
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                    <p className="font-display text-2xl font-extrabold">
                        Total {formatPeso(subtotal)}
                    </p>

                    <Button
                        type="submit"
                        size="lg"
                        className="min-h-14 rounded-full px-8 text-lg"
                        disabled={placing || soldOut > 0}
                    >
                        {placing ? 'Placing…' : 'Place order'}
                    </Button>
                </div>

                {message && (
                    <p role="alert" className="font-semibold text-destructive">
                        {message}
                    </p>
                )}
            </form>
        </>
    );
}
