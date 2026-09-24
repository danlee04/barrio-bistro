import { ShoppingBag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useLocation, useNavigate, useRouteLoaderData } from 'react-router';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { Plate } from '@/components/public/plate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_NOTE, priceCart } from '@/lib/cart';
import { useCart } from '@/lib/cart-context';
import { formatPeso } from '@/lib/money';
import type { publicMenuLoader } from '@/lib/public-menu';
import { cn } from '@/lib/utils';

/**
 * The order hangs in the corner and opens as a panel on the right, the way a
 * counter till sits beside the menu.
 */
export function CartDock() {
    const { cart, setQuantity, setNote, remove } = useCart();
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('order') ?? [];
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    const { lines, subtotal, soldOut } = priceCart(cart, categories);
    const count = lines.reduce(
        (total, priced) => total + priced.line.quantity,
        0,
    );

    // A dish just landed here: say so with a small bump.
    const [bumping, setBumping] = useState(false);
    const seen = useRef(count);

    useEffect(() => {
        if (count > seen.current) {
            setBumping(true);
        }

        seen.current = count;
    }, [count]);

    if (count === 0 || pathname === '/order/checkout') {
        return null;
    }

    return (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            {/* Keeps the footer clear of the button hanging over it. */}
            <div aria-hidden="true" className="h-20" />

            <DialogPrimitive.Trigger asChild>
                <button
                    type="button"
                    onAnimationEnd={() => setBumping(false)}
                    aria-label={`Open your order: ${count} ${count === 1 ? 'item' : 'items'}, ${formatPeso(subtotal)}`}
                    className={cn(
                        'fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex size-14 items-center justify-center rounded-full bg-achuete text-white shadow-lg',
                        bumping && 'cart-bump',
                    )}
                >
                    <ShoppingBag aria-hidden="true" className="size-6" />
                    <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 inline-flex min-w-6 items-center justify-center rounded-full border-2 border-pandan bg-dahon px-1 text-xs font-semibold text-pandan"
                    >
                        {count}
                    </span>
                </button>
            </DialogPrimitive.Trigger>

            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-uling/50" />

                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className="cart-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-88 flex-col bg-card shadow-2xl"
                >
                    <header className="flex items-center justify-between gap-4 border-b border-border p-4">
                        <DialogPrimitive.Title className="font-display text-2xl font-bold">
                            Your order
                        </DialogPrimitive.Title>

                        <DialogPrimitive.Close asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-11 rounded-full"
                                aria-label="Close your order"
                            >
                                <X aria-hidden="true" />
                            </Button>
                        </DialogPrimitive.Close>
                    </header>

                    <ul className="flex flex-1 flex-col divide-y divide-border overflow-y-auto overscroll-contain p-4">
                        {lines.map(({ line, item, size, lineTotal }) => (
                            <li
                                key={line.sizeId}
                                className="flex flex-col gap-2 py-3 first:pt-0"
                            >
                                <div className="flex items-start gap-3">
                                    <Plate item={item} size="card" />

                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <p className="text-sm font-semibold">
                                            {item.name}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {item.sizes.length > 1 &&
                                                `${size.name} · `}
                                            {formatPeso(size.price)} each
                                        </p>
                                        {!item.is_available && (
                                            <p className="text-sm font-semibold text-achuete">
                                                Sold out today
                                            </p>
                                        )}
                                    </div>

                                    <p className="text-sm font-semibold">
                                        {formatPeso(lineTotal)}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
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
                                    htmlFor={`dock-note-${line.sizeId}`}
                                    className="sr-only"
                                >
                                    {`Note for ${item.name}`}
                                </Label>
                                <Input
                                    id={`dock-note-${line.sizeId}`}
                                    value={line.note}
                                    maxLength={MAX_NOTE}
                                    placeholder="Note for the kitchen (optional)"
                                    onChange={(event) =>
                                        setNote(line.sizeId, event.target.value)
                                    }
                                />
                            </li>
                        ))}
                    </ul>

                    <footer className="flex flex-col gap-3 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                            type="button"
                            size="lg"
                            className="min-h-12 w-full rounded-full text-base"
                            disabled={soldOut > 0}
                            onClick={() => {
                                setOpen(false);
                                void navigate('/order/checkout');
                            }}
                        >
                            Checkout
                        </Button>
                    </footer>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
