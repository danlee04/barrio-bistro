import { http } from '@/lib/http';
import type { Direction } from '@/lib/menu';
import type { GalleryPhoto } from '@/types';

type Wrapped<T> = { data: T };

/** The gallery as visitors see it, in the order the shop arranged. */
export async function fetchGallery(): Promise<GalleryPhoto[]> {
    const response = await http.get<Wrapped<GalleryPhoto[]>>('/api/v1/gallery');

    return response.data;
}

/** The same photos, read through the admin endpoint. */
export async function listGalleryPhotos(): Promise<GalleryPhoto[]> {
    const response = await http.get<Wrapped<GalleryPhoto[]>>(
        '/api/v1/admin/gallery',
    );

    return response.data;
}

export function uploadGalleryPhoto(photo: File, caption: string) {
    const form = new FormData();
    form.append('photo', photo);

    if (caption !== '') {
        form.append('caption', caption);
    }

    return http.post<Wrapped<GalleryPhoto>>('/api/v1/admin/gallery', form);
}

export function updateGalleryCaption(id: number, caption: string | null) {
    return http.patch<Wrapped<GalleryPhoto>>(`/api/v1/admin/gallery/${id}`, {
        caption,
    });
}

export function deleteGalleryPhoto(id: number) {
    return http.delete<void>(`/api/v1/admin/gallery/${id}`);
}

export function moveGalleryPhoto(id: number, direction: Direction) {
    return http.post<void>(`/api/v1/admin/gallery/${id}/move`, { direction });
}

/** Loader: the gallery for the website. */
export function galleryLoader(): Promise<GalleryPhoto[]> {
    return fetchGallery();
}

/** Loader: the gallery for the admin screen. */
export function adminGalleryLoader(): Promise<GalleryPhoto[]> {
    return listGalleryPhotos();
}
