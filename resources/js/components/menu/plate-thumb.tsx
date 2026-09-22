import type { MenuItem } from '@/types';

export function PlateThumb({ item }: { item: MenuItem }) {
    if (item.image === null) {
        return (
            <div
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted font-display text-lg font-extrabold text-muted-foreground"
            >
                {item.name.charAt(0)}
            </div>
        );
    }

    return (
        <img
            src={item.image.sm}
            alt={item.name}
            width={48}
            height={48}
            loading="lazy"
            className="size-12 shrink-0 rounded-full object-cover"
        />
    );
}
