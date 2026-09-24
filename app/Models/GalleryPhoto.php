<?php

namespace App\Models;

use App\Models\Concerns\HasSortOrder;
use Database\Factories\GalleryPhotoFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * One picture on the website's gallery, in the order the shop arranged them.
 *
 * @property int $id
 * @property string $path
 * @property string|null $caption
 * @property int $sort_order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['caption'])]
class GalleryPhoto extends Model
{
    /** @use HasFactory<GalleryPhotoFactory> */
    use HasFactory, HasSortOrder;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'caption' => null,
        'sort_order' => 0,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    /**
     * Relative URLs of the square WebP renditions.
     *
     * @return array{sm: string, md: string}
     */
    public function imageUrls(): array
    {
        $disk = Storage::disk('public');

        return [
            'sm' => $disk->url($this->path.'-400.webp'),
            'md' => $disk->url($this->path.'-800.webp'),
        ];
    }

    /**
     * Gallery photos are ordered among themselves.
     *
     * @return Builder<static>
     */
    protected function sortSiblings(): Builder
    {
        return static::query();
    }
}
