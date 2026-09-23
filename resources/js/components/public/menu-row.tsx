import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Plate } from '@/components/public/plate';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-context';
import { formatPeso } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

/** One dish on the menu: its plate, its copy, and a button for every size. */
export function MenuRow({ item }: { item: MenuItem }) {
    const { add } = useCart();
    const [lifting, setLifting] = useState(false);

    function handleAdd(sizeId: number) {
        add(item.id, sizeId);
        setLifting(true);
    }

    return (
        <li className="flex items-start gap-4">
            <div
                className={cn('shrink-0', lifting && 'plate-lift')}
                onAnimationEnd={() => setLifting(false)}
            >
                <Plate item={item} size="menu" />
            </div>

            <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-lg leading-snug font-semibold">
                    {item.name}
                </h3>

                {item.description && (
                    <p className="line-clamp-3 text-muted-foreground">
                        {item.description}
                    </p>
                )}

                {item.is_available ? (
                    <ul className="flex flex-wrap gap-2">
                        {item.sizes.map((size) => (
                            <li key={size.id}>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="min-h-11 rounded-full font-display font-extrabold"
                                    aria-label={`Add ${item.name}${item.sizes.length > 1 ? `, ${size.name},` : ''} for ${formatPeso(size.price)}`}
                                    onClick={() => handleAdd(size.id)}
                                >
                                    <Plus aria-hidden="true" />
                                    {item.sizes.length > 1 && (
                                        <span className="font-sans font-medium">
                                            {size.name}
                                        </span>
                                    )}
                                    {formatPeso(size.price)}
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="font-semibold text-achuete">Sold out today</p>
                )}
            </div>
        </li>
    );
}
