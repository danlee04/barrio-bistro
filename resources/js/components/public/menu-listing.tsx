import { Fragment } from 'react';
import { formatPeso } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

/**
 * A dish as the website shows it: something to read, not to press. Every size
 * carries its price, because nobody reading a menu wants to tap to find out.
 */
export function MenuListing({ item }: { item: MenuItem }) {
    const soldOut = !item.is_available;

    return (
        <li className="flex gap-4 py-4">
            {item.image === null ? (
                <div
                    aria-hidden="true"
                    className={cn(
                        'flex size-20 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-2xl font-bold text-dahon',
                        soldOut && 'opacity-60',
                    )}
                >
                    {item.name.charAt(0)}
                </div>
            ) : (
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
                        'size-20 shrink-0 rounded-lg border border-border object-cover',
                        soldOut && 'opacity-60 grayscale',
                    )}
                />
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="font-semibold">{item.name}</h3>

                {item.description && (
                    <p className="max-w-[60ch] text-sm text-muted-foreground">
                        {item.description}
                    </p>
                )}

                {soldOut ? (
                    <p className="text-sm font-semibold text-achuete">
                        Sold out today
                    </p>
                ) : (
                    <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                        {item.sizes.map((size) => (
                            <Fragment key={size.id}>
                                {item.sizes.length > 1 && (
                                    <dt className="text-muted-foreground">
                                        {size.name}
                                    </dt>
                                )}
                                <dd className="font-semibold">
                                    {formatPeso(size.price)}
                                </dd>
                            </Fragment>
                        ))}
                    </dl>
                )}
            </div>
        </li>
    );
}
