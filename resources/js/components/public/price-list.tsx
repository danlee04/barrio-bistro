import { Fragment } from 'react';
import { formatPeso } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { MenuItemSize } from '@/types';

type PriceListProps = {
    sizes: MenuItemSize[];
    className?: string;
};

/** One large price, or each size with its own price. */
export function PriceList({ sizes, className }: PriceListProps) {
    if (sizes.length === 1) {
        return (
            <p className={cn('font-display text-xl font-bold', className)}>
                {formatPeso(sizes[0].price)}
            </p>
        );
    }

    return (
        <dl
            className={cn(
                'grid grid-cols-[auto_auto] justify-start gap-x-3 gap-y-0.5',
                className,
            )}
        >
            {sizes.map((size) => (
                <Fragment key={size.id}>
                    <dt className="opacity-80">{size.name}</dt>
                    <dd className="font-display font-bold">
                        {formatPeso(size.price)}
                    </dd>
                </Fragment>
            ))}
        </dl>
    );
}
