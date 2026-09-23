import { Check, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

function DishPhoto({ item }: { item: MenuItem }) {
    const frame = 'size-20 shrink-0 rounded-lg border border-border';
    const soldOut = !item.is_available;

    if (item.image === null) {
        return (
            <div
                aria-hidden="true"
                className={cn(
                    frame,
                    'flex items-center justify-center bg-pandan text-2xl font-bold text-dahon',
                    soldOut && 'opacity-60',
                )}
            >
                {item.name.charAt(0)}
            </div>
        );
    }

    return (
        <img
            src={item.image.sm}
            srcSet={`${item.image.sm} 400w, ${item.image.md} 800w`}
            sizes="80px"
            width={400}
            height={400}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className={cn(
                frame,
                'object-cover',
                soldOut && 'opacity-60 grayscale',
            )}
        />
    );
}

/**
 * One dish: its photo and sizes on the left, its name, price and the button on
 * the right. Both columns end at the same line, so the sizes and the button sit
 * side by side. The price waits until a size is chosen.
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
                'flex h-full gap-3 rounded-xl border border-border bg-card p-2.5 transition-colors duration-300',
                added && 'border-kalamansi bg-kalamansi/10',
            )}
        >
            <div className="flex shrink-0 flex-col gap-2">
                <div
                    className={cn(lifting && 'plate-lift')}
                    onAnimationEnd={() => setLifting(false)}
                >
                    <DishPhoto item={item} />
                </div>

                {item.is_available && item.sizes.length > 1 && (
                    <div
                        role="group"
                        aria-label={`Size for ${item.name}`}
                        className="mt-auto flex flex-wrap gap-1"
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
                                    'inline-flex size-9 items-center justify-center rounded-lg border text-xs font-semibold',
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
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-balance">
                    {item.name}
                </h3>

                {item.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                        {item.description}
                    </p>
                )}

                {item.is_available ? (
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p
                            className={cn(
                                'text-sm font-semibold',
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
                                'h-9 rounded-lg px-4 transition-colors duration-300',
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
                ) : (
                    <p className="mt-auto pt-1 text-sm font-semibold text-achuete">
                        Sold out today
                    </p>
                )}
            </div>
        </li>
    );
}
