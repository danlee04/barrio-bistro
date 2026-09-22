import { describe, expect, it } from 'vite-plus/test';
import { featuredItems } from '@/lib/public-menu';
import type { MenuCategory, MenuItem } from '@/types';

const item = (id: number, overrides: Partial<MenuItem> = {}): MenuItem => ({
    id,
    category_id: 1,
    name: `Dish ${id}`,
    description: null,
    image: null,
    is_available: true,
    is_featured: false,
    sort_order: id,
    archived_at: null,
    sizes: [{ id, name: 'Regular', price: 10000 }],
    ...overrides,
});

const menu = (items: MenuItem[]): MenuCategory[] => [
    {
        id: 1,
        name: 'Meals',
        slug: 'meals',
        description: null,
        sort_order: 0,
        archived_at: null,
        items,
    },
];

describe('featuredItems', () => {
    it('prefers featured items that are available', () => {
        const result = featuredItems(
            menu([
                item(1),
                item(2, { is_featured: true }),
                item(3, { is_featured: true, is_available: false }),
            ]),
        );

        expect(result.map((entry) => entry.id)).toEqual([2]);
    });

    it('falls back to the first available items when nothing is featured', () => {
        const result = featuredItems(
            menu([item(1, { is_available: false }), item(2), item(3)]),
        );

        expect(result.map((entry) => entry.id)).toEqual([2, 3]);
    });

    it('shows at most five plates', () => {
        const result = featuredItems(
            menu(
                [1, 2, 3, 4, 5, 6, 7].map((id) =>
                    item(id, { is_featured: true }),
                ),
            ),
        );

        expect(result).toHaveLength(5);
    });
});
