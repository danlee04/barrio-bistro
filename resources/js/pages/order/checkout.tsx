import { type FormEvent, useState } from 'react';
import {
    Link,
    useLoaderData,
    useNavigate,
    useRouteLoaderData,
} from 'react-router';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { Plate } from '@/components/public/plate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { restaurant } from '@/content/restaurant';
import { MAX_NOTE, priceCart } from '@/lib/cart';
import { useCart } from '@/lib/cart-context';
import { isKiosk } from '@/lib/kiosk';
import { HttpError, type ValidationErrors } from '@/lib/http';
import { formatPeso } from '@/lib/money';
import { placeOrder, rememberOrder } from '@/lib/orders';
import {
    canPayOnline,
    type checkoutOptionsLoader,
    createCheckoutSession,
} from '@/lib/payments';
import type { publicMenuLoader } from '@/lib/public-menu';
import { cn } from '@/lib/utils';
import type { OrderType, PaymentMethod } from '@/types';

const choice =
    'flex min-h-20 flex-col justify-center rounded-xl border-2 px-4 text-left';

export default function Cart() {
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('order') ?? [];
    const { cart, setQuantity, setNote, remove, setTable, clear } = useCart();
    const navigate = useNavigate();

    const options = useLoaderData<typeof checkoutOptionsLoader>();
    const [kiosk] = useState(() => isKiosk());
    const [type, setType] = useState<OrderType>('dine_in');
    const [method, setMethod] = useState<PaymentMethod>('counter');
    const [name, setName] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [message, setMessage] = useState<string | null>(null);
    const [placing, setPlacing] = useState(false);

    const { lines, subtotal, soldOut } = priceCart(cart, categories);
    const onlineAvailable = canPayOnline(subtotal, options);
    const error = (field: string) => errors[field]?.[0];

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrors({});
        setMessage(null);
        setPlacing(true);

        try {
            const order = await placeOrder({
                type,
                table_number: !kiosk && type === 'dine_in' ? cart.table : null,
                customer_name: kiosk || type === 'takeout' ? name.trim() : null,
                payment_method: onlineAvailable ? method : 'counter',
                items: lines.map(({ line }) => ({
                    menu_item_id: line.itemId,
                    menu_item_size_id: line.sizeId,
                    quantity: line.quantity,
                    note: line.note.trim() === '' ? null : line.note.trim(),
                })),
            });

            rememberOrder(order.token);
            clear();

            if (onlineAvailable && method === 'online') {
                try {
                    const payment = await createCheckoutSession(order.token);

                    if (payment.checkout_url !== null) {
                        window.location.assign(payment.checkout_url);

                        return;
                    }
                } catch {
                    // The order is placed either way. The status screen offers
                    // both trying again and paying at the counter.
                }
            }

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
                    <h1 className="font-display text-4xl font-bold tracking-tight">
                        Your order is empty.
                    </h1>
                    <p className="text-lg">Pick something from today's menu.</p>
                    <Link
                        to="/order"
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
                className="wrapper grid gap-8 py-10 lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-10"
            >
                <h1 className="font-display text-4xl font-bold tracking-tight lg:col-span-2">
                    Your order
                </h1>

                <div className="flex flex-col gap-8">
                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-2 font-display text-xl font-bold">
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
                                    {option === 'dine_in'
                                        ? 'Dine in'
                                        : 'Take out'}
                                </button>
                            ))}
                        </div>

                        {type === 'dine_in' && !kiosk ? (
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
                                        It is printed on the QR card on your
                                        table.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                <Label htmlFor="name">
                                    Name, so we can call you
                                </Label>
                                <Input
                                    id="name"
                                    value={name}
                                    maxLength={40}
                                    autoComplete="given-name"
                                    aria-invalid={
                                        error('customer_name')
                                            ? true
                                            : undefined
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

                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-2 font-display text-xl font-bold">
                            How would you like to pay?
                        </legend>

                        <div role="group" className="grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                aria-pressed={
                                    !onlineAvailable || method === 'counter'
                                }
                                onClick={() => setMethod('counter')}
                                className={cn(
                                    choice,
                                    !onlineAvailable || method === 'counter'
                                        ? 'border-dahon bg-dahon text-pandan'
                                        : 'border-border bg-card',
                                )}
                            >
                                <span className="font-display text-lg font-bold">
                                    Pay at the counter
                                </span>
                                <span className="text-sm opacity-80">
                                    The kitchen starts once it is paid.
                                </span>
                            </button>

                            {onlineAvailable && (
                                <button
                                    type="button"
                                    aria-pressed={method === 'online'}
                                    onClick={() => setMethod('online')}
                                    className={cn(
                                        choice,
                                        method === 'online'
                                            ? 'border-dahon bg-dahon text-pandan'
                                            : 'border-border bg-card',
                                    )}
                                >
                                    <span className="font-display text-lg font-bold">
                                        Pay online
                                    </span>
                                    <span className="text-sm opacity-80">
                                        GCash or card, on PayMongo's page.
                                    </span>
                                </button>
                            )}
                        </div>
                    </fieldset>
                </div>

                <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
                    <h2 className="font-display text-xl font-bold">
                        {lines.length} {lines.length === 1 ? 'dish' : 'dishes'}
                    </h2>

                    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card px-4">
                        {lines.map(({ line, item, size, lineTotal }, index) => (
                            <li
                                key={line.sizeId}
                                className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
                            >
                                <Plate item={item} size="chip" />

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">
                                        {item.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.sizes.length > 1 &&
                                            `${size.name} · `}
                                        {formatPeso(size.price)} each
                                    </p>

                                    {!item.is_available && (
                                        <p className="text-xs font-semibold text-achuete">
                                            Sold out today — remove it to carry
                                            on.
                                        </p>
                                    )}

                                    {error(
                                        `items.${index}.menu_item_size_id`,
                                    ) && (
                                        <p className="text-xs font-semibold text-destructive">
                                            {error(
                                                `items.${index}.menu_item_size_id`,
                                            )}
                                        </p>
                                    )}
                                </div>

                                <p className="text-sm font-semibold">
                                    {formatPeso(lineTotal)}
                                </p>

                                <div className="flex w-full items-center justify-between gap-2">
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
                                        size="sm"
                                        className="min-h-11"
                                        onClick={() => remove(line.sizeId)}
                                    >
                                        Remove
                                    </Button>
                                </div>

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
                                    className="h-9 text-sm"
                                    onChange={(event) =>
                                        setNote(line.sizeId, event.target.value)
                                    }
                                />
                            </li>
                        ))}
                    </ul>

                    <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg lg:static lg:shadow-none">
                        <div className="flex items-center justify-between">
                            <p className="font-medium">Total</p>
                            <p className="font-display text-2xl font-bold">
                                {formatPeso(subtotal)}
                            </p>
                        </div>

                        {soldOut > 0 && (
                            <p className="text-sm font-semibold text-achuete">
                                Remove the sold-out dishes to carry on.
                            </p>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            className="min-h-12 w-full rounded-full text-base"
                            disabled={placing || soldOut > 0}
                        >
                            {placing ? 'Placing…' : 'Place order'}
                        </Button>

                        {message && (
                            <p
                                role="alert"
                                className="text-sm font-semibold text-destructive"
                            >
                                {message}
                            </p>
                        )}
                    </div>
                </aside>
            </form>
        </>
    );
}
