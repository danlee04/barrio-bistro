import { DishPhoto } from '@/components/public/dish-photo';
import type { MenuItem } from '@/types';

/**
 * A dish on the reading menu: a portrait card, photo first. No prices here —
 * those belong on the order screen, where a number is something you act on
 * rather than something you squint at.
 */
export function DishCard({ item }: { item: MenuItem }) {
    return (
        <li className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(23,17,15,0.04),0_8px_24px_-16px_rgba(23,17,15,0.35)]">
            <DishPhoto item={item} />

            <div className="flex flex-1 flex-col gap-1 p-2.5">
                <h3 className="font-display text-sm leading-snug font-bold text-balance">
                    {item.name}
                </h3>

                {item.description && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                    </p>
                )}

                {item.sizes.length > 1 && (
                    <p className="mt-auto truncate pt-1 text-xs text-muted-foreground">
                        {item.sizes.map((size) => size.name).join(' · ')}
                    </p>
                )}
            </div>
        </li>
    );
}
