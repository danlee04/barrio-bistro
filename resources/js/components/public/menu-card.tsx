import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Plate } from '@/components/public/plate';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-context';
import { formatPeso } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

/** "Regular" becomes R, but "12oz" stays whole: a number is not an initial. */
function sizeInitial(name: string): string {
    const first = name.charAt(0);

    return /\p{L}/u.test(first) ? first.toUpperCase() : name;
}

/**
 * One dish on a card: its plate on the left, its name on the right, and the
 * price kept back until a size is chosen — so nothing shows a price the guest
 * cannot order at.
 */
export function MenuCard({ item }: { item: MenuItem }) {
    const { add } = useCart();
    const [sizeId, setSizeId] = useState<number | null>(
        item.sizes.length === 1 ? item.sizes[0].id : null,
    );
    const [lifting, setLifting] = useState(false);

    const size = item.sizes.find((entry) => entry.id === sizeId) ?? null;

    function handleAdd() {
        if (size === null) {
            return;
        }

        add(item.id, size.id);
        setLifting(true);
    }

    return (
        <li className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex items-start gap-3">
                <div
                    className={cn('shrink-0', lifting && 'plate-lift')}
                    onAnimationEnd={() => setLifting(false)}
                >
                    <Plate item={item} size="card" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <h3 className="text-sm leading-snug font-semibold text-balance">
                        {item.name}
                    </h3>

                    {item.is_available ? (
                        <>
                            {item.sizes.length > 1 && (
                                <div
                                    role="group"
                                    aria-label={`Size for ${item.name}`}
                                    className="flex flex-wrap gap-1.5"
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
                                                'inline-flex size-8 items-center justify-center rounded-full border text-xs font-semibold',
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

                            <p
                                className={cn(
                                    'text-sm font-semibold',
                                    size === null &&
                                        'font-normal text-muted-foreground',
                                )}
                            >
                                {size === null
                                    ? 'Pick a size'
                                    : formatPeso(size.price)}
                            </p>
                        </>
                    ) : (
                        <p className="text-sm font-semibold text-achuete">
                            Sold out today
                        </p>
                    )}
                </div>
            </div>

            {item.is_available && (
                <Button
                    type="button"
                    size="sm"
                    className="mt-auto min-h-10 w-full rounded-full"
                    disabled={size === null}
                    aria-label={
                        size === null
                            ? `Pick a size for ${item.name}`
                            : `Add ${item.name}${item.sizes.length > 1 ? `, ${size.name},` : ''} for ${formatPeso(size.price)}`
                    }
                    onClick={handleAdd}
                >
                    <Plus aria-hidden="true" />
                    Add
                </Button>
            )}
        </li>
    );
}
