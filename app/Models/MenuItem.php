<?php

namespace App\Models;

use App\Models\Concerns\HasSortOrder;
use Database\Factories\MenuItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $category_id
 * @property string $name
 * @property string|null $description
 * @property string|null $image_path
 * @property bool $is_available
 * @property bool $is_featured
 * @property int $sort_order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Category $category
 * @property-read Collection<int, MenuItemSize> $sizes
 */
#[Fillable(['category_id', 'name', 'description', 'is_featured'])]
class MenuItem extends Model
{
    /** @use HasFactory<MenuItemFactory> */
    use HasFactory, HasSortOrder, SoftDeletes;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'description' => null,
        'image_path' => null,
        'is_available' => true,
        'is_featured' => false,
        'sort_order' => 0,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_available' => 'boolean',
            'is_featured' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * The category, even when it has been archived.
     *
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class)->withTrashed();
    }

    /**
     * Sizes in display order.
     *
     * @return HasMany<MenuItemSize, $this>
     */
    public function sizes(): HasMany
    {
        return $this->hasMany(MenuItemSize::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * Size name => price in centavos, in display order (used for audit diffs).
     *
     * @return array<string, int>
     */
    public function priceList(): array
    {
        return $this->sizes()->get()
            ->mapWithKeys(fn (MenuItemSize $size): array => [$size->name => $size->price])
            ->all();
    }

    /**
     * Replace this item's sizes, keeping the ids of sizes that stay so carts remain valid.
     *
     * @param  array<int, array{id?: int|null, name: string, price: int}>  $sizes
     */
    public function syncSizes(array $sizes): void
    {
        $keptIds = array_values(array_filter(array_column($sizes, 'id')));

        $this->sizes()->whereNotIn('id', $keptIds)->delete();

        foreach (array_values($sizes) as $position => $size) {
            $attributes = ['name' => $size['name'], 'price' => $size['price'], 'sort_order' => $position];
            $existingId = $size['id'] ?? null;

            if ($existingId !== null) {
                $this->sizes()->whereKey($existingId)->update($attributes);
            } else {
                $this->sizes()->create($attributes);
            }
        }

        $this->unsetRelation('sizes');
    }

    /**
     * Relative URLs of the square WebP renditions, or null when there is no photo.
     *
     * @return array{sm: string, md: string}|null
     */
    public function imageUrls(): ?array
    {
        if ($this->image_path === null) {
            return null;
        }

        $disk = Storage::disk('public');

        return [
            'sm' => $disk->url($this->image_path.'-400.webp'),
            'md' => $disk->url($this->image_path.'-800.webp'),
        ];
    }

    /**
     * Items are ordered within their category.
     *
     * @return Builder<static>
     */
    protected function sortSiblings(): Builder
    {
        return static::query()->where('category_id', $this->category_id);
    }
}
