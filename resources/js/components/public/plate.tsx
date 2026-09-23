import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

type PlateProps = {
    item: MenuItem;
    size: 'hero' | 'menu' | 'card';
    priority?: boolean;
};

const sizes = {
    hero: {
        box: 'size-32 sm:size-36 md:size-44',
        hint: '(min-width: 768px) 176px, 144px',
    },
    menu: { box: 'size-24 md:size-28', hint: '112px' },
    card: { box: 'size-20 md:size-24', hint: '96px' },
};

/** A dish photo served on a bilao: a round image inside a woven bamboo rim. */
export function Plate({ item, size, priority = false }: PlateProps) {
    const { box, hint } = sizes[size];

    return (
        <div
            className={cn('plate', box, !item.is_available && 'plate-sold-out')}
        >
            {item.image ? (
                <img
                    src={item.image.md}
                    srcSet={`${item.image.sm} 400w, ${item.image.md} 800w`}
                    sizes={hint}
                    width={400}
                    height={400}
                    alt={item.name}
                    loading={priority ? 'eager' : 'lazy'}
                    fetchPriority={priority ? 'high' : 'auto'}
                    decoding="async"
                    className="size-full rounded-full object-cover"
                />
            ) : (
                <span
                    aria-hidden="true"
                    className="flex size-full items-center justify-center rounded-full bg-pandan font-display text-3xl font-bold text-dahon"
                >
                    {item.name.charAt(0)}
                </span>
            )}
        </div>
    );
}
