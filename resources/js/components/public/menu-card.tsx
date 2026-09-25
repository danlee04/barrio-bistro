import { Check, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DishPhoto } from '@/components/public/dish-photo';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-context';
import { formatPeso } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

/** How long the button says "Added" before going back to work. */
const ADDED_MS = 1200;

/** "Regular" becomes R, but "12oz" stays whole: a number is not an initial. */
function sizeInitial(name: string): string {
    const first = name.charAt(0);

    return /\p{L}/u.test(first) ? first.toUpperCase() : name;
}

/**
 * The same portrait card the website shows, with the till's work added under
 * it: pick a size, see what it costs, add it. The price waits for the size,
 * because a dish with three sizes has no single price to show.
 */
export function MenuCard({ item }: { item: MenuItem }) {
    const { add } = useCart();
    const [sizeId, setSizeId] = useState<number | null>(
        item.sizes.length === 1 ? item.sizes[0].id : null,
    );
    const [lifting, setLifting] = useState(false);
    const [added, setAdded] = useState(false);
    const timer = useRef<number | null>(null);

    const size = item.sizes.find((entry) => entry.id === sizeId) ?? null;
    const soldOut = !item.is_available;

    useEffect(
        () => () => {
            if (timer.current !== null) {
                window.clearTimeout(timer.current);
            }
        },
        [],
    );

    function handleAdd() {
        if (size === null) {
            return;
        }

        add(item.id, size.id);
        setLifting(true);
        setAdded(true);

        if (timer.current !== null) {
            window.clearTimeout(timer.current);
        }

        timer.current = window.setTimeout(() => setAdded(false), ADDED_MS);
    }

    return (
        <li
            className={cn(
                'group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(23,17,15,0.04),0_8px_24px_-16px_rgba(23,17,15,0.35)] transition-colors duration-300',
                added && 'border-kalamansi',
            )}
        >
            <div
                className={cn(lifting && 'plate-lift')}
                onAnimationEnd={() => setLifting(false)}
            >
                <DishPhoto item={item} />
            </div>

            <div
                className={cn(
                    'flex flex-1 flex-col gap-1 p-2.5 transition-colors duration-300',
                    added && 'bg-kalamansi/10',
                )}
            >
                <h3 className="font-display text-sm leading-snug font-bold text-balance">
                    {item.name}
                </h3>

                {item.description && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                    </p>
                )}

                {!soldOut && (
                    <div className="mt-auto flex flex-col gap-1.5 pt-1.5">
                        {item.sizes.length > 1 && (
                            <div
                                role="group"
                                aria-label={`Size for ${item.name}`}
                                className="flex gap-1"
                            >
                                {item.sizes.map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        aria-pressed={entry.id === sizeId}
                                        aria-label={entry.name}
                                        title={entry.name}
                                        onClick={() => setSizeId(entry.id)}
                                        className={cn(
                                            'inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                                            entry.id === sizeId
                                                ? 'border-dahon bg-dahon text-pandan'
                                                : 'border-border hover:bg-muted',
                                        )}
                                    >
                                        {sizeInitial(entry.name)}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                            <p
                                className={cn(
                                    'font-display text-base font-bold',
                                    size === null &&
                                        'text-xs font-normal text-muted-foreground',
                                )}
                            >
                                {size === null
                                    ? 'Pick a size'
                                    : formatPeso(size.price)}
                            </p>

                            <Button
                                type="button"
                                size="sm"
                                className={cn(
                                    'min-h-9 shrink-0 rounded-full px-3 text-xs transition-colors duration-300',
                                    added &&
                                        'bg-kalamansi text-uling hover:bg-kalamansi',
                                )}
                                disabled={size === null}
                                aria-label={
                                    size === null
                                        ? `Pick a size for ${item.name}`
                                        : `Add ${item.name}${item.sizes.length > 1 ? `, ${size.name},` : ''} for ${formatPeso(size.price)}`
                                }
                                onClick={handleAdd}
                            >
                                {added ? (
                                    <>
                                        <Check aria-hidden="true" />
                                        Added
                                    </>
                                ) : (
                                    <>
                                        <Plus aria-hidden="true" />
                                        Add
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </li>
    );
}
