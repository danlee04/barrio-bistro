/** Edge, in pixels, of the square every uploaded photo is cut to. */
export const PHOTO_EDGE = 800;

/** Originals above this size are refused before the browser tries to decode them. */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

export type SquareCrop = { x: number; y: number; size: number };

export type PreparedPhoto = {
    file: File;
    wasUpscaled: boolean;
};

/** The centred square of an image, which becomes the round "plate". */
export function squareCrop(width: number, height: number): SquareCrop {
    const size = Math.min(width, height);

    return {
        x: Math.floor((width - size) / 2),
        y: Math.floor((height - size) / 2),
        size,
    };
}

/**
 * Cut any photo to its centred square and scale it to 800×800 in the browser,
 * upright according to the camera, so uploads are small and never fail on
 * size or dimensions. The server still validates and re-encodes the result.
 */
export async function preparePhoto(original: File): Promise<PreparedPhoto> {
    const bitmap = await createImageBitmap(original, {
        imageOrientation: 'from-image',
    });

    try {
        const crop = squareCrop(bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = PHOTO_EDGE;
        canvas.height = PHOTO_EDGE;

        const context = canvas.getContext('2d');

        if (context === null) {
            throw new Error('This browser cannot prepare photos.');
        }

        context.imageSmoothingQuality = 'high';
        context.drawImage(
            bitmap,
            crop.x,
            crop.y,
            crop.size,
            crop.size,
            0,
            0,
            PHOTO_EDGE,
            PHOTO_EDGE,
        );

        const blob = await canvasToBlob(canvas);
        const extension = blob.type === 'image/webp' ? 'webp' : 'png';

        return {
            file: new File([blob], `photo.${extension}`, {
                type: blob.type,
            }),
            wasUpscaled: crop.size < PHOTO_EDGE,
        };
    } finally {
        bitmap.close();
    }
}

/** WebP where the browser can encode it; otherwise the browser falls back to PNG. */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Could not prepare the photo.'));
                }
            },
            'image/webp',
            0.9,
        );
    });
}
