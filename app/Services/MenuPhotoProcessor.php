<?php

namespace App\Services;

use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class MenuPhotoProcessor
{
    /**
     * Edges (in pixels) of the square renditions to generate; each is saved as "{base}-{edge}.webp".
     *
     * @var list<positive-int>
     */
    private const EDGES = [400, 800];

    /**
     * Re-encode an uploaded photo into square WebP renditions and return their base path.
     *
     * Decoding to pixels and encoding again throws away everything that is not the
     * picture itself: EXIF (including GPS), comments and any smuggled script.
     */
    public function store(UploadedFile $photo): string
    {
        $square = $this->cropToSquare($this->decode($photo));
        $basePath = sprintf('menu-items/%s/%s', now()->format('Y/m'), Str::lower((string) Str::ulid()));

        foreach (self::EDGES as $edge) {
            Storage::disk('public')->put("{$basePath}-{$edge}.webp", $this->encodeWebp($square, $edge));
        }

        return $basePath;
    }

    /**
     * Delete every rendition of a stored photo.
     */
    public function delete(string $basePath): void
    {
        Storage::disk('public')->delete(array_map(
            fn (int $edge): string => "{$basePath}-{$edge}.webp",
            self::EDGES,
        ));
    }

    /**
     * Decode the upload into pixels, upright according to its EXIF orientation.
     *
     * @throws ValidationException
     */
    private function decode(UploadedFile $photo): GdImage
    {
        $contents = $photo->get();
        $image = is_string($contents) ? @imagecreatefromstring($contents) : false;

        if (! $image instanceof GdImage) {
            throw ValidationException::withMessages(['photo' => 'The photo could not be read. Try another file.']);
        }

        return $this->applyExifOrientation($image, $photo);
    }

    /**
     * Rotate phone photos the way the camera meant, before the EXIF data is thrown away.
     */
    private function applyExifOrientation(GdImage $image, UploadedFile $photo): GdImage
    {
        $path = $photo->getRealPath();

        if ($photo->getMimeType() !== 'image/jpeg' || $path === false || ! function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data($path);
        $orientation = is_array($exif) && is_numeric($exif['Orientation'] ?? null) ? (int) $exif['Orientation'] : 1;

        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };

        return $rotated instanceof GdImage ? $rotated : $image;
    }

    /**
     * Keep the centred square, since plates on the menu are round.
     */
    private function cropToSquare(GdImage $image): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $edge = min($width, $height);

        $square = imagecrop($image, [
            'x' => intdiv($width - $edge, 2),
            'y' => intdiv($height - $edge, 2),
            'width' => $edge,
            'height' => $edge,
        ]);

        if (! $square instanceof GdImage) {
            throw new RuntimeException('The photo could not be cropped.');
        }

        return $square;
    }

    /**
     * Scale the square down to the given edge and encode it as WebP.
     *
     * @param  positive-int  $edge
     */
    private function encodeWebp(GdImage $square, int $edge): string
    {
        $canvas = imagecreatetruecolor($edge, $edge);

        if (! $canvas instanceof GdImage) {
            throw new RuntimeException('Could not allocate the photo canvas.');
        }

        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        imagecopyresampled($canvas, $square, 0, 0, 0, 0, $edge, $edge, imagesx($square), imagesy($square));

        ob_start();
        imagewebp($canvas, null, 82);
        $webp = ob_get_clean();

        if (! is_string($webp) || $webp === '') {
            throw new RuntimeException('Could not encode the photo.');
        }

        return $webp;
    }
}
