import { fetchMenu } from '@/lib/menu';
import type { MenuCategory, MenuItem } from '@/types';

const HERO_LIMIT = 5;

/** The plates for the hero: available featured items, else the first available ones. */
export function featuredItems(categories: MenuCategory[]): MenuItem[] {
    const available = categories
        .flatMap((category) => category.items)
        .filter((entry) => entry.is_available);
    const featured = available.filter((entry) => entry.is_featured);

    return (featured.length > 0 ? featured : available).slice(0, HERO_LIMIT);
}

/** Loader: the public menu for the home and menu pages. */
export function publicMenuLoader(): Promise<MenuCategory[]> {
    return fetchMenu();
}
