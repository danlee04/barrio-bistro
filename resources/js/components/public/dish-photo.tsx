import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

/**
 * A dish in its square frame, with whatever the shop has said about it: the
 * house's own pick, or that today's pot is empty. Shared by the reading menu
 * and the till so a dish looks the same wherever it is seen.
 */
export function DishPhoto({ item }: { item: MenuItem }) {
    const soldOut = !item.is_available;

    return (
        <div className="relative aspect-4/3 bg-muted">
            {item.image === null ? (
                <div
                    aria-hidden="true"
                    className="flex h-full items-center justify-center font-display text-4xl font-bold text-dahon/25"
                >
                    {item.name.charAt(0)}
                </div>
            ) : (
                <img
                    src={item.image.md}
                    srcSet={`${item.image.sm} 400w, ${item.image.md} 800w`}
                    sizes="(min-width: 1024px) 14rem, (min-width: 640px) 25vw, 45vw"
                    width={800}
                    height={800}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className={cn(
                        'h-full w-full object-cover',
                        soldOut && 'grayscale',
                    )}
                />
            )}

            {/* The rim, so a pale dish never bleeds into the card. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 ring-1 ring-uling/8 ring-inset"
            />

            {item.is_featured && !soldOut && (
                <p className="absolute top-2 left-2 rounded-full bg-pandan/95 px-2.5 py-0.5 text-xs font-semibold text-dahon shadow-sm">
                    House pick
                </p>
            )}

            {soldOut && (
                <p className="absolute inset-x-0 bottom-0 bg-uling/80 py-1 text-center text-xs font-semibold text-pandan">
                    Sold out today
                </p>
            )}
        </div>
    );
}
