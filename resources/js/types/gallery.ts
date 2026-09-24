export type GalleryImage = {
    sm: string;
    md: string;
};

export type GalleryPhoto = {
    id: number;
    caption: string | null;
    sort_order: number;
    image: GalleryImage;
};
