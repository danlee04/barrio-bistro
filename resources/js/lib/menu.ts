import type { LoaderFunctionArgs } from 'react-router';
import { http } from '@/lib/http';
import type { Category, MenuCategory, MenuItem, Paginated } from '@/types';

type Wrapped<T> = { data: T };

export type Direction = 'up' | 'down';

export type SizeInput = { id?: number; name: string; price: number };

export type MenuItemInput = {
    category_id: number;
    name: string;
    description: string | null;
    is_featured: boolean;
    sizes: SizeInput[];
};

export type CategoryInput = { name: string; description: string | null };

export async function fetchMenu(): Promise<MenuCategory[]> {
    const response = await http.get<Wrapped<MenuCategory[]>>('/api/v1/menu');

    return response.data;
}

export async function listCategories(archived = false): Promise<Category[]> {
    const response = await http.get<Wrapped<Category[]>>(
        `/api/v1/admin/categories${archived ? '?archived=1' : ''}`,
    );

    return response.data;
}

export function createCategory(input: CategoryInput) {
    return http.post<Wrapped<Category>>('/api/v1/admin/categories', input);
}

export function updateCategory(id: number, input: CategoryInput) {
    return http.patch<Wrapped<Category>>(
        `/api/v1/admin/categories/${id}`,
        input,
    );
}

export function archiveCategory(id: number) {
    return http.delete<void>(`/api/v1/admin/categories/${id}`);
}

export function restoreCategory(id: number) {
    return http.post<Wrapped<Category>>(
        `/api/v1/admin/categories/${id}/restore`,
    );
}

export function moveCategory(id: number, direction: Direction) {
    return http.post<void>(`/api/v1/admin/categories/${id}/move`, {
        direction,
    });
}

export async function getMenuItem(id: number): Promise<MenuItem> {
    const response = await http.get<Wrapped<MenuItem>>(
        `/api/v1/admin/menu-items/${id}`,
    );

    return response.data;
}

export function createMenuItem(input: MenuItemInput) {
    return http.post<Wrapped<MenuItem>>('/api/v1/admin/menu-items', input);
}

export function updateMenuItem(id: number, input: MenuItemInput) {
    return http.patch<Wrapped<MenuItem>>(
        `/api/v1/admin/menu-items/${id}`,
        input,
    );
}

export function archiveMenuItem(id: number) {
    return http.delete<void>(`/api/v1/admin/menu-items/${id}`);
}

export function restoreMenuItem(id: number) {
    return http.post<Wrapped<MenuItem>>(
        `/api/v1/admin/menu-items/${id}/restore`,
    );
}

export function moveMenuItem(id: number, direction: Direction) {
    return http.post<void>(`/api/v1/admin/menu-items/${id}/move`, {
        direction,
    });
}

export function uploadMenuItemPhoto(id: number, photo: File) {
    const form = new FormData();
    form.append('photo', photo);

    return http.post<Wrapped<MenuItem>>(
        `/api/v1/admin/menu-items/${id}/photo`,
        form,
    );
}

export function removeMenuItemPhoto(id: number) {
    return http.delete<Wrapped<MenuItem>>(
        `/api/v1/admin/menu-items/${id}/photo`,
    );
}

export function setMenuItemAvailability(id: number, isAvailable: boolean) {
    return http.patch<Wrapped<MenuItem>>(
        `/api/v1/menu-items/${id}/availability`,
        { is_available: isAvailable },
    );
}

export async function listArchivedMenuItems(): Promise<MenuItem[]> {
    const response = await http.get<Paginated<MenuItem>>(
        '/api/v1/admin/menu-items?archived=1&per_page=100',
    );

    return response.data;
}

/** Loader: the live menu grouped by category. */
export function menuBoardLoader(): Promise<MenuCategory[]> {
    return fetchMenu();
}

/** Loader: categories for the form, plus the item when editing. */
export async function menuItemFormLoader({
    params,
}: LoaderFunctionArgs): Promise<{
    categories: Category[];
    item: MenuItem | null;
}> {
    const [categories, item] = await Promise.all([
        listCategories(),
        params.itemId
            ? getMenuItem(Number(params.itemId))
            : Promise.resolve(null),
    ]);

    return { categories, item };
}

/** Loader: active and archived categories. */
export async function categoriesLoader(): Promise<{
    active: Category[];
    archived: Category[];
}> {
    const [active, archived] = await Promise.all([
        listCategories(),
        listCategories(true),
    ]);

    return { active, archived };
}

/** Loader: archived items with a restore action. */
export function archivedItemsLoader(): Promise<MenuItem[]> {
    return listArchivedMenuItems();
}
