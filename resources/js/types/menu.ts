export type MenuItemSize = {
    id: number;
    name: string;
    price: number;
};

export type MenuItemImage = {
    sm: string;
    md: string;
};

export type MenuItem = {
    id: number;
    category_id: number;
    category_name?: string;
    name: string;
    description: string | null;
    image: MenuItemImage | null;
    is_available: boolean;
    is_featured: boolean;
    sort_order: number;
    archived_at: string | null;
    sizes: MenuItemSize[];
};

export type Category = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    sort_order: number;
    items_count?: number;
    archived_at: string | null;
};

export type MenuCategory = Category & {
    items: MenuItem[];
};
