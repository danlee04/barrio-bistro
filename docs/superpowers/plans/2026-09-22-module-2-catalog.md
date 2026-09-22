# Module 2 — Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Working agreement:** Claude writes the code and runs the verification commands (tests, Pint, PHPStan, lint, build). The user runs mutating commands (`migrate`, `npm install`, `npx shadcn add`, `storage:link`, `git commit`). Commits are consolidated about every 5 steps.

**Goal:** Categories, menu items with sizes (each size with its own price), one photo per item, archive/restore, reordering, an "Ubos na" (sold out) toggle for all staff, a public read-only menu API, and the admin screens to manage it all.

**Architecture:** Three tables (`categories`, `menu_items`, `menu_item_sizes`). Categories and items use soft deletes as "archive"; sizes are hard-deleted because orders will snapshot names and prices. Prices are integer centavos stored only on sizes. Photos are re-encoded server-side with GD into two square WebP renditions on the `public` disk. Admin endpoints live under `/api/v1/admin/*` (`role:admin` + policies). The availability toggle is its own endpoint that any active staff role may call. `GET /api/v1/menu` is public, with a guest rate limit sized for many customers sharing the restaurant's Wi-Fi IP.

**Tech Stack:** Laravel 13, Pest 5, PHP GD (WebP), React 19 + React Router 8, shadcn/ui, Vitest via `vp test`.

**Spec:** `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md` (Sections 4, 6, 7)

## Global Constraints

- Money is **integer centavos**: `price` between `1` and `10000000` (₱0.01–₱100,000). The UI converts pesos to centavos with string arithmetic, never floats.
- Each item has 1–6 sizes; size names are unique per item (case-insensitive).
- Archive = soft delete. Archived categories hide all their items from the public menu. Nothing in the catalog is ever hard-deleted from the UI.
- `is_available` is **not** mass-assignable. It changes only through the availability endpoint.
- Photo upload: `mimetypes:image/jpeg,image/png,image/webp`, `extensions:jpg,jpeg,png,webp`, `max:5120`, `dimensions:min_width=800,min_height=800,max_width=4096,max_height=4096`. Always re-encoded (strips EXIF/GPS and anything that is not pixels), with generated ULID names, and never upscaled.
- Processing is synchronous by design: admin-only, rare, and bounded to 4096 px (~130 MB peak with GD). Revisit (queue it) if uploads become frequent. **Production needs `memory_limit` ≥ 256M** (track in Module 8).
- Every catalog change is audited: create/update (with a price diff)/archive/restore/photo/availability.
- New folder `app/Services` (approved by the user for `MenuPhotoProcessor`) and subfolder `app/Models/Concerns`.
- Security rules in `CLAUDE.md` → _Security Guidelines_ apply to every task.

## File Map

| File                                                                                                                                                     | Responsibility                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `database/migrations/2026_09_22_200000_create_categories_table.php`, `…_200100_create_menu_items_table.php`, `…_200200_create_menu_item_sizes_table.php` | Schema                                                                                            |
| `app/Models/Concerns/HasSortOrder.php`                                                                                                                   | `nextSortOrder()`, `moveInSortOrder()`                                                            |
| `app/Models/Category.php`, `MenuItem.php`, `MenuItemSize.php` + factories                                                                                | Catalog models                                                                                    |
| `app/Models/AuditLog.php`                                                                                                                                | `recordChange()` gains `$extraChanges` (the price diff)                                           |
| `app/Http/Resources/CategoryResource.php`, `MenuItemResource.php`, `MenuItemSizeResource.php`                                                            | API shapes                                                                                        |
| `app/Http/Controllers/PublicMenuController.php`                                                                                                          | `GET /api/v1/menu`                                                                                |
| `app/Http/Controllers/Admin/CategoryController.php`, `MenuItemController.php`, `MenuItemPhotoController.php`                                             | Admin catalog API                                                                                 |
| `app/Http/Controllers/MenuItemAvailabilityController.php`                                                                                                | Staff sold-out toggle                                                                             |
| `app/Http/Requests/Admin/*Category*`, `*MenuItem*`, `MoveRequest.php`, `app/Http/Requests/UpdateMenuItemAvailabilityRequest.php`                         | Validation + authorization                                                                        |
| `app/Policies/CategoryPolicy.php`, `MenuItemPolicy.php`                                                                                                  | Who may do what                                                                                   |
| `app/Services/MenuPhotoProcessor.php`                                                                                                                    | GD pipeline: orient → square → 400/800 WebP                                                       |
| `config/filesystems.php`                                                                                                                                 | `public` disk URL becomes relative (`/storage`), so images match CSP `img-src 'self'` on any host |
| `resources/js/lib/money.ts` + `money.test.ts`                                                                                                            | Peso ⇄ centavos (unit-tested)                                                                     |
| `resources/js/lib/menu.ts`, `resources/js/types/menu.ts`                                                                                                 | API client, loaders, types                                                                        |
| `resources/js/components/confirm-dialog.tsx`, `components/menu/*`                                                                                        | Shared UI                                                                                         |
| `resources/js/pages/admin/menu/*.tsx`                                                                                                                    | Board, item form, categories, archived                                                            |

---

### Task 1: Schema and models

**Files:** the 3 migrations, `HasSortOrder`, 3 models + 3 factories, `tests/Feature/Catalog/CatalogModelsTest.php`.

**Interfaces — Produces:** `Category` (`name`, `slug` auto from name, `description`, `sort_order`; `menuItems()` ordered; SoftDeletes), `MenuItem` (`category()` includes archived categories, `sizes()` ordered, `priceList(): array<string,int>`, `syncSizes(array)`, `imageUrls(): ?array{sm,md}`; SoftDeletes), `MenuItemSize` (`name`, `price`, `sort_order`); `nextSortOrder(): int`, `moveInSortOrder('up'|'down')`; factory states `MenuItem::factory()->unavailable()/featured()` (a created item always gets a "Regular" size unless sizes were given).

- [ ] **Step 1: Failing test** — `tests/Feature/Catalog/CatalogModelsTest.php`

```php
<?php

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\MenuItemSize;
use Illuminate\Database\Eloquent\MassAssignmentException;

test('a category slug follows its name', function () {
    $category = Category::factory()->create(['name' => 'Merienda & Snacks']);

    expect($category->slug)->toBe('merienda-snacks');

    $category->update(['name' => 'Drinks']);

    expect($category->fresh()->slug)->toBe('drinks');
});

test('archived categories and items leave default queries and can be restored', function () {
    $item = MenuItem::factory()->create();
    $item->delete();
    $item->category->delete();

    expect(MenuItem::query()->count())->toBe(0)
        ->and(Category::query()->count())->toBe(0);

    $item->restore();
    $item->category->restore();

    expect(MenuItem::query()->count())->toBe(1);
});

test('a new item gets a Regular size, and sizes come back in display order', function () {
    $item = MenuItem::factory()->create();

    expect($item->sizes)->toHaveCount(1)
        ->and($item->sizes->first()->name)->toBe('Regular');

    $item->syncSizes([
        ['name' => 'Large', 'price' => 16000],
        ['name' => 'Small', 'price' => 12000],
    ]);

    expect($item->fresh()->sizes->pluck('name')->all())->toBe(['Large', 'Small'])
        ->and($item->priceList())->toBe(['Large' => 16000, 'Small' => 12000]);
});

test('syncing sizes keeps the ids of sizes that stay and removes the rest', function () {
    $item = MenuItem::factory()
        ->has(MenuItemSize::factory()->count(2)->sequence(['name' => 'Small'], ['name' => 'Large']), 'sizes')
        ->create();
    [$small, $large] = $item->sizes->all();

    $item->syncSizes([
        ['id' => $small->id, 'name' => 'Small', 'price' => 9900],
        ['name' => 'Family', 'price' => 45000],
    ]);

    $sizes = $item->fresh()->sizes;

    expect($sizes->pluck('name')->all())->toBe(['Small', 'Family'])
        ->and($sizes->first()->id)->toBe($small->id)
        ->and($sizes->first()->price)->toBe(9900)
        ->and(MenuItemSize::query()->find($large->id))->toBeNull();
});

test('availability cannot be mass assigned', function () {
    expect(fn () => new MenuItem(['name' => 'Adobo', 'is_available' => false]))
        ->toThrow(MassAssignmentException::class);
});

test('items move within their own category only', function () {
    $category = Category::factory()->create();
    $first = MenuItem::factory()->for($category)->create();
    $second = MenuItem::factory()->for($category)->create();
    $elsewhere = MenuItem::factory()->create();
    $first->forceFill(['sort_order' => $first->nextSortOrder()])->save();
    $second->forceFill(['sort_order' => $second->nextSortOrder()])->save();

    $second->moveInSortOrder('up');

    expect($category->menuItems()->pluck('id')->all())->toBe([$second->id, $first->id])
        ->and($elsewhere->fresh()->sort_order)->toBe(0);
});

test('photo urls are relative and only exist when there is a photo', function () {
    $item = MenuItem::factory()->create();

    expect($item->imageUrls())->toBeNull();

    $item->forceFill(['image_path' => 'menu-items/2026/09/01jabc'])->save();

    expect($item->imageUrls())->toBe([
        'sm' => '/storage/menu-items/2026/09/01jabc-400.webp',
        'md' => '/storage/menu-items/2026/09/01jabc-800.webp',
    ]);
});
```

- [ ] **Step 2: Run (FAIL)** — `php artisan test --compact tests/Feature/Catalog/CatalogModelsTest.php` → `Class "App\Models\Category" not found`.

- [ ] **Step 3: Migrations**

`2026_09_22_200000_create_categories_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->string('slug', 80)->unique();
            $table->string('description', 255)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['deleted_at', 'sort_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
```

`2026_09_22_200100_create_menu_items_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('menu_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->string('name', 80)->unique();
            $table->string('description', 500)->nullable();
            $table->string('image_path')->nullable();
            $table->boolean('is_available')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['category_id', 'deleted_at', 'sort_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('menu_items');
    }
};
```

`2026_09_22_200200_create_menu_item_sizes_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('menu_item_sizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('menu_item_id')->constrained()->cascadeOnDelete();
            $table->string('name', 40);
            $table->unsignedInteger('price');
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['menu_item_id', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('menu_item_sizes');
    }
};
```

- [ ] **Step 4: `app/Models/Concerns/HasSortOrder.php`**

```php
<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

trait HasSortOrder
{
    /**
     * The query for the records this one is ordered among.
     *
     * @return Builder<static>
     */
    abstract protected function sortSiblings(): Builder;

    /**
     * The next free position at the end of this record's siblings.
     */
    public function nextSortOrder(): int
    {
        $highest = $this->sortSiblings()->max('sort_order');

        return is_numeric($highest) ? (int) $highest + 1 : 0;
    }

    /**
     * Swap this record with its neighbour ('up' or 'down') and renumber the siblings 0..n.
     */
    public function moveInSortOrder(string $direction): void
    {
        DB::transaction(function () use ($direction): void {
            $siblings = $this->sortSiblings()
                ->orderBy('sort_order')
                ->orderBy($this->getKeyName())
                ->lockForUpdate()
                ->get()
                ->values()
                ->all();

            $index = null;

            foreach ($siblings as $position => $sibling) {
                if ($sibling->is($this)) {
                    $index = $position;
                }
            }

            if ($index === null) {
                return;
            }

            $target = $direction === 'up' ? $index - 1 : $index + 1;

            if (! isset($siblings[$target])) {
                return;
            }

            [$siblings[$index], $siblings[$target]] = [$siblings[$target], $siblings[$index]];

            foreach ($siblings as $position => $sibling) {
                if ($sibling->getAttribute('sort_order') !== $position) {
                    $sibling->setAttribute('sort_order', $position);
                    $sibling->save();
                }
            }
        });
    }
}
```

- [ ] **Step 5: `app/Models/Category.php`**

```php
<?php

namespace App\Models;

use App\Models\Concerns\HasSortOrder;
use Database\Factories\CategoryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property int $sort_order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Fillable(['name', 'description'])]
class Category extends Model
{
    /** @use HasFactory<CategoryFactory> */
    use HasFactory, HasSortOrder, SoftDeletes;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'description' => null,
        'sort_order' => 0,
    ];

    /**
     * Keep the slug in step with the name.
     */
    protected static function booted(): void
    {
        static::saving(function (Category $category): void {
            $category->slug = Str::slug($category->name);
        });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    /**
     * Menu items in this category, in display order (archived items excluded).
     *
     * @return HasMany<MenuItem, $this>
     */
    public function menuItems(): HasMany
    {
        return $this->hasMany(MenuItem::class)->orderBy('sort_order')->orderBy('name');
    }

    /**
     * All categories are ordered together.
     *
     * @return Builder<static>
     */
    protected function sortSiblings(): Builder
    {
        return static::query();
    }
}
```

- [ ] **Step 6: `app/Models/MenuItem.php`**

```php
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
```

- [ ] **Step 7: `app/Models/MenuItemSize.php`**

```php
<?php

namespace App\Models;

use Database\Factories\MenuItemSizeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $menu_item_id
 * @property string $name
 * @property int $price
 * @property int $sort_order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'price', 'sort_order'])]
class MenuItemSize extends Model
{
    /** @use HasFactory<MenuItemSizeFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    /**
     * The item this size belongs to.
     *
     * @return BelongsTo<MenuItem, $this>
     */
    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }
}
```

- [ ] **Step 8: Factories**

`database/factories/CategoryFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => Str::title(rtrim(fake()->unique()->sentence(2), '.')),
            'description' => fake()->optional()->sentence(),
            'sort_order' => 0,
        ];
    }
}
```

`database/factories/MenuItemFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MenuItem>
 */
class MenuItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'category_id' => Category::factory(),
            'name' => Str::title(rtrim(fake()->unique()->sentence(3), '.')),
            'description' => fake()->sentence(),
            'is_available' => true,
            'is_featured' => false,
            'sort_order' => 0,
        ];
    }

    /**
     * Give every created item a "Regular" size unless the test supplied sizes.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (MenuItem $item): void {
            if ($item->sizes()->doesntExist()) {
                $item->sizes()->create([
                    'name' => 'Regular',
                    'price' => fake()->numberBetween(50, 400) * 100,
                    'sort_order' => 0,
                ]);
            }
        });
    }

    /**
     * Indicate that the item is sold out.
     */
    public function unavailable(): static
    {
        return $this->state(fn (array $attributes) => ['is_available' => false]);
    }

    /**
     * Indicate that the item is featured in the hero.
     */
    public function featured(): static
    {
        return $this->state(fn (array $attributes) => ['is_featured' => true]);
    }
}
```

`database/factories/MenuItemSizeFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\MenuItem;
use App\Models\MenuItemSize;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MenuItemSize>
 */
class MenuItemSizeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'menu_item_id' => MenuItem::factory(),
            'name' => Str::title(fake()->unique()->word()),
            'price' => fake()->numberBetween(50, 400) * 100,
            'sort_order' => 0,
        ];
    }
}
```

- [ ] **Step 9: Relative public-disk URLs** — in `config/filesystems.php`, the `public` disk's `'url'` becomes:

```php
            'url' => '/storage',
```

- [ ] **Step 10: Run (PASS)** — the test file, then the full suite and PHPStan. The user runs `php artisan migrate`.

---

### Task 2: Public menu API + guest rate limit

**Files:** `app/Http/Resources/CategoryResource.php`, `MenuItemResource.php`, `MenuItemSizeResource.php`, `app/Http/Controllers/PublicMenuController.php`, `routes/api.php`, `app/Providers/AppServiceProvider.php`, `tests/Feature/Catalog/PublicMenuTest.php`.

**Interfaces — Produces:** `GET /api/v1/menu` (`menu.show`) → `{ data: [{ id, name, slug, description, sort_order, archived_at, items: [{ id, category_id, name, description, image, is_available, is_featured, sort_order, archived_at, sizes: [{id, name, price}] }] }] }`. Categories are in order, empty or archived categories are left out, archived items are left out, and sold-out items are **included**. The `api` limiter becomes 60/min per signed-in user or **300/min per IP for guests**.

- [ ] **Step 1: Failing test** — `tests/Feature/Catalog/PublicMenuTest.php`

```php
<?php

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\MenuItemSize;

test('guests see the menu grouped by category in display order', function () {
    $drinks = Category::factory()->create(['name' => 'Drinks', 'sort_order' => 2]);
    $meals = Category::factory()->create(['name' => 'Meals', 'sort_order' => 1]);
    $adobo = MenuItem::factory()->for($meals)->create(['name' => 'Adobo', 'sort_order' => 1]);
    MenuItem::factory()->for($meals)->create(['name' => 'Sisig', 'sort_order' => 0]);
    MenuItem::factory()->for($drinks)
        ->has(MenuItemSize::factory()->count(2)->sequence(
            ['name' => '12oz', 'price' => 9000, 'sort_order' => 0],
            ['name' => '16oz', 'price' => 11000, 'sort_order' => 1],
        ), 'sizes')
        ->create(['name' => 'Iced Coffee']);

    $this->getJson('/api/v1/menu')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Meals')
        ->assertJsonPath('data.0.items.0.name', 'Sisig')
        ->assertJsonPath('data.0.items.1.id', $adobo->id)
        ->assertJsonPath('data.1.items.0.sizes.0.name', '12oz')
        ->assertJsonPath('data.1.items.0.sizes.1.price', 11000);
});

test('sold-out items stay on the menu but archived ones do not', function () {
    $category = Category::factory()->create();
    MenuItem::factory()->for($category)->unavailable()->create(['name' => 'Kare-Kare']);
    MenuItem::factory()->for($category)->create(['name' => 'Old Dish'])->delete();

    $this->getJson('/api/v1/menu')
        ->assertOk()
        ->assertJsonCount(1, 'data.0.items')
        ->assertJsonPath('data.0.items.0.name', 'Kare-Kare')
        ->assertJsonPath('data.0.items.0.is_available', false);
});

test('empty and archived categories are hidden', function () {
    Category::factory()->create(['name' => 'Empty']);
    $archived = Category::factory()->create(['name' => 'Archived']);
    MenuItem::factory()->for($archived)->create();
    $archived->delete();

    $this->getJson('/api/v1/menu')->assertOk()->assertJsonCount(0, 'data');
});

test('the menu is served to a busy restaurant sharing one ip', function () {
    MenuItem::factory()->create();

    foreach (range(1, 300) as $request) {
        $this->getJson('/api/v1/menu')->assertOk();
    }

    $this->getJson('/api/v1/menu')->assertTooManyRequests();
});
```

- [ ] **Step 2: Run (FAIL)** — 404 on `/api/v1/menu`.

- [ ] **Step 3: Resources**

`app/Http/Resources/MenuItemSizeResource.php`:

```php
<?php

namespace App\Http\Resources;

use App\Models\MenuItemSize;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin MenuItemSize
 */
class MenuItemSizeResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'price' => $this->price,
        ];
    }
}
```

`app/Http/Resources/MenuItemResource.php`:

```php
<?php

namespace App\Http\Resources;

use App\Models\MenuItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin MenuItem
 */
class MenuItemResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category_name' => $this->whenLoaded('category', fn (): string => $this->category->name),
            'name' => $this->name,
            'description' => $this->description,
            'image' => $this->imageUrls(),
            'is_available' => $this->is_available,
            'is_featured' => $this->is_featured,
            'sort_order' => $this->sort_order,
            'archived_at' => $this->deleted_at?->toIso8601String(),
            'sizes' => MenuItemSizeResource::collection($this->whenLoaded('sizes')),
        ];
    }
}
```

`app/Http/Resources/CategoryResource.php`:

```php
<?php

namespace App\Http\Resources;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Category
 */
class CategoryResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'sort_order' => $this->sort_order,
            'items_count' => $this->whenCounted('menuItems'),
            'archived_at' => $this->deleted_at?->toIso8601String(),
            'items' => MenuItemResource::collection($this->whenLoaded('menuItems')),
        ];
    }
}
```

- [ ] **Step 4: `app/Http/Controllers/PublicMenuController.php`**

```php
<?php

namespace App\Http\Controllers;

use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicMenuController extends Controller
{
    /**
     * The live menu: non-empty categories in order, each with its items and sizes.
     */
    public function __invoke(): AnonymousResourceCollection
    {
        $categories = Category::query()
            ->whereHas('menuItems')
            ->with('menuItems.sizes')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return CategoryResource::collection($categories);
    }
}
```

- [ ] **Step 5: Route + limiter** — in `routes/api.php` add, **outside** the auth group (import `App\Http\Controllers\PublicMenuController`):

```php
Route::get('/menu', PublicMenuController::class)->name('menu.show');
```

In `AppServiceProvider::configureRateLimiting()`, replace the `api` limiter:

```php
        RateLimiter::for('api', function (Request $request): Limit {
            $user = $request->user();

            return $user !== null
                ? Limit::perMinute(60)->by('user:'.$user->getAuthIdentifier())
                : Limit::perMinute(300)->by('ip:'.$request->ip());
        });
```

- [ ] **Step 6: Run (PASS)** — the test file, then the full suite (the per-user API limit test must still pass) and PHPStan.

---

### Task 3: Category admin API

**Files:** `app/Policies/CategoryPolicy.php`, `app/Http/Requests/Admin/ListCategoriesRequest.php`, `StoreCategoryRequest.php`, `UpdateCategoryRequest.php`, `MoveRequest.php`, `app/Http/Controllers/Admin/CategoryController.php`, `app/Models/AuditLog.php`, `routes/api.php`, `tests/Feature/Catalog/CategoryManagementTest.php`.

**Interfaces — Produces:** `GET /api/v1/admin/categories[?archived=1]` (with `items_count`), `POST` (201), `PATCH /{category}`, `DELETE /{category}` (archive → 204), `POST /{category}/restore`, `POST /{category}/move` `{direction: up|down}` (204). Audit: `category.created|updated|archived|restored`. `AuditLog::recordChange(..., array $extraChanges = [])`.

- [ ] **Step 1: Failing test** — `tests/Feature/Catalog/CategoryManagementTest.php`

```php
<?php

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

test('an admin adds a category at the end of the list', function () {
    Category::factory()->create(['sort_order' => 4]);

    $this->actingAs($this->admin)
        ->postJson('/api/v1/admin/categories', ['name' => 'Merienda', 'description' => 'Afternoon snacks'])
        ->assertCreated()
        ->assertJsonPath('data.slug', 'merienda')
        ->assertJsonPath('data.sort_order', 5);

    $this->assertDatabaseHas('audit_logs', ['action' => 'category.created', 'causer_id' => $this->admin->id]);
});

test('category names must be unique, even against archived ones and near-duplicates', function (string $name) {
    Category::factory()->create(['name' => 'Drinks'])->delete();

    $this->actingAs($this->admin)
        ->postJson('/api/v1/admin/categories', ['name' => $name])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');
})->with(['Drinks', 'drinks!', '!!!', '']);

test('renaming updates the slug and is audited', function () {
    $category = Category::factory()->create(['name' => 'Drinks']);

    $this->actingAs($this->admin)
        ->patchJson("/api/v1/admin/categories/{$category->id}", ['name' => 'Beverages'])
        ->assertOk()
        ->assertJsonPath('data.slug', 'beverages');

    expect(AuditLog::query()->where('action', 'category.updated')->sole()->changes)
        ->toMatchArray(['name' => ['from' => 'Drinks', 'to' => 'Beverages']]);
});

test('archiving hides a category and its items, and restoring brings them back', function () {
    $category = Category::factory()->create();
    MenuItem::factory()->for($category)->create();

    $this->actingAs($this->admin)->deleteJson("/api/v1/admin/categories/{$category->id}")->assertNoContent();
    $this->getJson('/api/v1/menu')->assertJsonCount(0, 'data');
    $this->actingAs($this->admin)->getJson('/api/v1/admin/categories?archived=1')->assertJsonCount(1, 'data');

    $this->actingAs($this->admin)->postJson("/api/v1/admin/categories/{$category->id}/restore")->assertOk();
    $this->getJson('/api/v1/menu')->assertJsonCount(1, 'data');

    $this->assertDatabaseHas('audit_logs', ['action' => 'category.archived']);
    $this->assertDatabaseHas('audit_logs', ['action' => 'category.restored']);
});

test('categories can be moved up and down', function () {
    $first = Category::factory()->create(['sort_order' => 0]);
    $second = Category::factory()->create(['sort_order' => 1]);

    $this->actingAs($this->admin)
        ->postJson("/api/v1/admin/categories/{$second->id}/move", ['direction' => 'up'])
        ->assertNoContent();

    expect(Category::query()->orderBy('sort_order')->pluck('id')->all())->toBe([$second->id, $first->id]);

    $this->actingAs($this->admin)
        ->postJson("/api/v1/admin/categories/{$second->id}/move", ['direction' => 'sideways'])
        ->assertUnprocessable();
});

test('only admins manage categories', function (string $role) {
    $staff = User::factory()->{$role}()->create();
    $category = Category::factory()->create();

    $this->actingAs($staff)->getJson('/api/v1/admin/categories')->assertForbidden();
    $this->actingAs($staff)->postJson('/api/v1/admin/categories', ['name' => 'X'])->assertForbidden();
    $this->actingAs($staff)->patchJson("/api/v1/admin/categories/{$category->id}", ['name' => 'Y'])->assertForbidden();
    $this->actingAs($staff)->deleteJson("/api/v1/admin/categories/{$category->id}")->assertForbidden();
})->with(['cashier', 'kitchen']);
```

- [ ] **Step 2: Run (FAIL)** — 404s.

- [ ] **Step 3: `AuditLog::recordChange()` gains extra changes** — replace the method:

```php
    /**
     * Record an update as a before/after diff of the attributes changed by the last save,
     * plus any extra before/after pairs the caller computed (e.g. a price list).
     *
     * @param  array<string, array{from: mixed, to: mixed}>  $extraChanges
     */
    public static function recordChange(string $action, Model $subject, ?User $causer = null, array $extraChanges = []): self
    {
        $previous = $subject->getPrevious();
        $changes = [];

        foreach ($subject->getChanges() as $attribute => $newValue) {
            if ($attribute === $subject->getUpdatedAtColumn()) {
                continue;
            }

            $changes[$attribute] = ['from' => $previous[$attribute] ?? null, 'to' => $newValue];
        }

        return self::record($action, $subject, $causer, changes: [...$changes, ...$extraChanges]);
    }
```

- [ ] **Step 4: `app/Policies/CategoryPolicy.php`**

```php
<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;

class CategoryPolicy
{
    /**
     * Determine whether the user can list categories in the admin.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can add a category.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can rename or reorder a category.
     */
    public function update(User $user, Category $category): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can archive a category.
     */
    public function delete(User $user, Category $category): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore an archived category.
     */
    public function restore(User $user, Category $category): bool
    {
        return $user->isAdmin();
    }
}
```

- [ ] **Step 5: Requests**

`app/Http/Requests/Admin/ListCategoriesRequest.php`:

```php
<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ListCategoriesRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Category::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'archived' => ['nullable', 'boolean'],
        ];
    }
}
```

`app/Http/Requests/Admin/StoreCategoryRequest.php`:

```php
<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreCategoryRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', Category::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:60', Rule::unique(Category::class, 'name')],
            'description' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * The name must make a usable slug that no category (archived ones included) already has.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $name = $this->input('name');

                if (! is_string($name) || $validator->errors()->has('name')) {
                    return;
                }

                $slug = Str::slug($name);

                if ($slug === '') {
                    $validator->errors()->add('name', 'The name must contain letters or numbers.');
                } elseif (Category::withTrashed()->where('slug', $slug)->exists()) {
                    $validator->errors()->add('name', 'A category with a very similar name already exists (it may be archived).');
                }
            },
        ];
    }
}
```

`app/Http/Requests/Admin/UpdateCategoryRequest.php`:

```php
<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateCategoryRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $category = $this->route('category');

        return $category instanceof Category && ($this->user()?->can('update', $category) ?? false);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:60', Rule::unique(Category::class, 'name')->ignore($this->route('category'))],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    /**
     * The new name must make a usable slug that no other category already has.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $name = $this->input('name');
                $category = $this->route('category');

                if (! is_string($name) || ! $category instanceof Category || $validator->errors()->has('name')) {
                    return;
                }

                $slug = Str::slug($name);

                if ($slug === '') {
                    $validator->errors()->add('name', 'The name must contain letters or numbers.');
                } elseif (Category::withTrashed()->where('slug', $slug)->whereKeyNot($category->id)->exists()) {
                    $validator->errors()->add('name', 'A category with a very similar name already exists (it may be archived).');
                }
            },
        ];
    }
}
```

`app/Http/Requests/Admin/MoveRequest.php`:

```php
<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class MoveRequest extends FormRequest
{
    /**
     * Authorization happens in the controller with the specific model's policy.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'direction' => ['required', 'in:up,down'],
        ];
    }
}
```

- [ ] **Step 6: `app/Http/Controllers/Admin/CategoryController.php`**

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListCategoriesRequest;
use App\Http\Requests\Admin\MoveRequest;
use App\Http\Requests\Admin\StoreCategoryRequest;
use App\Http\Requests\Admin\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\AuditLog;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class CategoryController extends Controller
{
    /**
     * Active (or archived) categories in display order, with how many items each has.
     */
    public function index(ListCategoriesRequest $request): AnonymousResourceCollection
    {
        $query = Category::query()->withCount('menuItems')->orderBy('sort_order')->orderBy('name');

        if ($request->boolean('archived')) {
            $query->onlyTrashed();
        }

        return CategoryResource::collection($query->get());
    }

    /**
     * Add a category at the end of the list.
     */
    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = new Category($request->validated());
        $category->sort_order = $category->nextSortOrder();
        $category->save();

        AuditLog::record('category.created', $category);

        return CategoryResource::make($category)->response()->setStatusCode(201);
    }

    /**
     * Rename or describe a category.
     */
    public function update(UpdateCategoryRequest $request, Category $category): CategoryResource
    {
        $category->fill($request->validated());
        $category->save();

        if ($category->wasChanged()) {
            AuditLog::recordChange('category.updated', $category);
        }

        return CategoryResource::make($category);
    }

    /**
     * Archive a category; its items disappear from the menu with it.
     */
    public function destroy(Category $category): Response
    {
        Gate::authorize('delete', $category);

        $category->delete();
        AuditLog::record('category.archived', $category);

        return response()->noContent();
    }

    /**
     * Bring an archived category back.
     */
    public function restore(Category $category): CategoryResource
    {
        Gate::authorize('restore', $category);

        $category->restore();
        AuditLog::record('category.restored', $category);

        return CategoryResource::make($category);
    }

    /**
     * Move a category one place up or down.
     */
    public function move(MoveRequest $request, Category $category): Response
    {
        Gate::authorize('update', $category);

        $category->moveInSortOrder($request->string('direction')->toString());

        return response()->noContent();
    }
}
```

- [ ] **Step 7: Routes** — inside the `admin` group in `routes/api.php` (import `App\Http\Controllers\Admin\CategoryController`):

```php
            Route::get('/categories', [CategoryController::class, 'index'])->name('categories.index');
            Route::post('/categories', [CategoryController::class, 'store'])->name('categories.store');
            Route::patch('/categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
            Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');
            Route::post('/categories/{category}/restore', [CategoryController::class, 'restore'])->withTrashed()->name('categories.restore');
            Route::post('/categories/{category}/move', [CategoryController::class, 'move'])->name('categories.move');
```

- [ ] **Step 8: Run (PASS)** — the test file, the full suite, PHPStan, Pint.

---

### Task 4: Menu item admin API

**Files:** `app/Policies/MenuItemPolicy.php`, `app/Http/Requests/Admin/ListMenuItemsRequest.php`, `StoreMenuItemRequest.php`, `UpdateMenuItemRequest.php`, `app/Http/Controllers/Admin/MenuItemController.php`, `routes/api.php`, `tests/Feature/Catalog/MenuItemManagementTest.php`.

**Interfaces — Produces:** `GET /api/v1/admin/menu-items[?archived=1&category_id=&search=&per_page=]` (paginated, 50 by default, max 100), `GET /{menuItem}`, `POST` (201), `PATCH /{menuItem}` (sizes synced by id), `DELETE` (archive, 204), `POST /{menuItem}/restore`, `POST /{menuItem}/move`. Audit: `menu_item.created` (context: `sizes`), `menu_item.updated` (changes include `sizes: {from, to}` when prices change), `menu_item.archived|restored`. `MenuItemPolicy::viewAny|view|create|update|delete|restore` (admin) and `updateAvailability(User)` (admin, cashier, kitchen).

- [ ] **Step 1: Failing test** — `tests/Feature/Catalog/MenuItemManagementTest.php`

```php
<?php

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\MenuItemSize;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->category = Category::factory()->create();
});

function menuItemPayload(int $categoryId, array $overrides = []): array
{
    return array_merge([
        'category_id' => $categoryId,
        'name' => 'Iced Coffee',
        'description' => 'Barako over ice',
        'is_featured' => true,
        'sizes' => [
            ['name' => '12oz', 'price' => 9000],
            ['name' => '16oz', 'price' => 11000],
        ],
    ], $overrides);
}

test('an admin adds an item with sizes', function () {
    $this->actingAs($this->admin)
        ->postJson('/api/v1/admin/menu-items', menuItemPayload($this->category->id))
        ->assertCreated()
        ->assertJsonPath('data.name', 'Iced Coffee')
        ->assertJsonPath('data.is_available', true)
        ->assertJsonPath('data.sizes.1.price', 11000);

    expect(AuditLog::query()->where('action', 'menu_item.created')->sole()->context)
        ->toBe(['sizes' => ['12oz' => 9000, '16oz' => 11000]]);
});

test('prices must be whole centavos between one centavo and one hundred thousand pesos', function (mixed $price) {
    $this->actingAs($this->admin)
        ->postJson('/api/v1/admin/menu-items', menuItemPayload($this->category->id, ['sizes' => [['name' => 'Regular', 'price' => $price]]]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('sizes.0.price');
})->with([0, -100, 10000001, 12.5, '12.50', null]);

test('an item needs at least one size with distinct names', function () {
    $this->actingAs($this->admin)
        ->postJson('/api/v1/admin/menu-items', menuItemPayload($this->category->id, ['sizes' => []]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('sizes');

    $this->actingAs($this->admin)
        ->postJson('/api/v1/admin/menu-items', menuItemPayload($this->category->id, ['sizes' => [
            ['name' => 'Large', 'price' => 100],
            ['name' => 'large', 'price' => 200],
        ]]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('sizes.0.name');
});

test('items cannot be added to an archived category', function () {
    $this->category->delete();

    $this->actingAs($this->admin)
        ->postJson('/api/v1/admin/menu-items', menuItemPayload($this->category->id))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('category_id');
});

test('a price change is audited with before and after, and kept sizes keep their ids', function () {
    $item = MenuItem::factory()->for($this->category)
        ->has(MenuItemSize::factory()->count(2)->sequence(
            ['name' => 'Small', 'price' => 12000, 'sort_order' => 0],
            ['name' => 'Large', 'price' => 16000, 'sort_order' => 1],
        ), 'sizes')
        ->create(['name' => 'Adobo']);
    $small = $item->sizes->first();

    $this->actingAs($this->admin)
        ->patchJson("/api/v1/admin/menu-items/{$item->id}", ['sizes' => [
            ['id' => $small->id, 'name' => 'Small', 'price' => 13500],
        ]])
        ->assertOk()
        ->assertJsonPath('data.sizes.0.id', $small->id)
        ->assertJsonCount(1, 'data.sizes');

    expect(AuditLog::query()->where('action', 'menu_item.updated')->sole()->changes)->toBe([
        'sizes' => [
            'from' => ['Small' => 12000, 'Large' => 16000],
            'to' => ['Small' => 13500],
        ],
    ]);
});

test('a size id from another item is rejected', function () {
    $item = MenuItem::factory()->for($this->category)->create();
    $foreignSize = MenuItem::factory()->create()->sizes->first();

    $this->actingAs($this->admin)
        ->patchJson("/api/v1/admin/menu-items/{$item->id}", ['sizes' => [
            ['id' => $foreignSize->id, 'name' => 'Hijacked', 'price' => 1],
        ]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('sizes.0.id');
});

test('availability is ignored by the edit endpoint', function () {
    $item = MenuItem::factory()->for($this->category)->create();

    $this->actingAs($this->admin)
        ->patchJson("/api/v1/admin/menu-items/{$item->id}", ['name' => 'Renamed', 'is_available' => false])
        ->assertOk()
        ->assertJsonPath('data.is_available', true);
});

test('archiving hides an item from the menu and restoring brings it back', function () {
    $item = MenuItem::factory()->for($this->category)->create();

    $this->actingAs($this->admin)->deleteJson("/api/v1/admin/menu-items/{$item->id}")->assertNoContent();
    $this->getJson('/api/v1/menu')->assertJsonCount(0, 'data');
    $this->actingAs($this->admin)->getJson('/api/v1/admin/menu-items?archived=1')->assertJsonPath('data.0.id', $item->id);

    $this->actingAs($this->admin)->postJson("/api/v1/admin/menu-items/{$item->id}/restore")->assertOk();
    $this->getJson('/api/v1/menu')->assertJsonCount(1, 'data');
});

test('items move within their category', function () {
    $first = MenuItem::factory()->for($this->category)->create(['sort_order' => 0]);
    $second = MenuItem::factory()->for($this->category)->create(['sort_order' => 1]);

    $this->actingAs($this->admin)
        ->postJson("/api/v1/admin/menu-items/{$second->id}/move", ['direction' => 'up'])
        ->assertNoContent();

    expect($this->category->menuItems()->pluck('id')->all())->toBe([$second->id, $first->id]);
});

test('only admins manage menu items', function (string $role) {
    $staff = User::factory()->{$role}()->create();
    $item = MenuItem::factory()->for($this->category)->create();

    $this->actingAs($staff)->getJson('/api/v1/admin/menu-items')->assertForbidden();
    $this->actingAs($staff)->postJson('/api/v1/admin/menu-items', menuItemPayload($this->category->id))->assertForbidden();
    $this->actingAs($staff)->patchJson("/api/v1/admin/menu-items/{$item->id}", ['name' => 'X'])->assertForbidden();
    $this->actingAs($staff)->deleteJson("/api/v1/admin/menu-items/{$item->id}")->assertForbidden();
})->with(['cashier', 'kitchen']);
```

- [ ] **Step 2: Run (FAIL)**.

- [ ] **Step 3: `app/Policies/MenuItemPolicy.php`**

```php
<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\MenuItem;
use App\Models\User;

class MenuItemPolicy
{
    /**
     * Determine whether the user can list items in the admin.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can open an item for editing.
     */
    public function view(User $user, MenuItem $menuItem): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can add items.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can change an item's details, prices or photo.
     */
    public function update(User $user, MenuItem $menuItem): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can archive an item.
     */
    public function delete(User $user, MenuItem $menuItem): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore an archived item.
     */
    public function restore(User $user, MenuItem $menuItem): bool
    {
        return $user->isAdmin();
    }

    /**
     * Any staff role may mark items sold out ("Ubos na") or available again.
     */
    public function updateAvailability(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Cashier, Role::Kitchen);
    }
}
```

- [ ] **Step 4: Requests**

`app/Http/Requests/Admin/ListMenuItemsRequest.php`:

```php
<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListMenuItemsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', MenuItem::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'archived' => ['nullable', 'boolean'],
            'category_id' => ['nullable', 'integer', Rule::exists(Category::class, 'id')],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
```

`app/Http/Requests/Admin/StoreMenuItemRequest.php`:

```php
<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMenuItemRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', MenuItem::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', Rule::exists(Category::class, 'id')->withoutTrashed()],
            'name' => ['required', 'string', 'max:80', Rule::unique(MenuItem::class, 'name')],
            'description' => ['nullable', 'string', 'max:500'],
            'is_featured' => ['sometimes', 'boolean'],
            'sizes' => ['required', 'array', 'min:1', 'max:6'],
            'sizes.*.name' => ['required', 'string', 'max:40', 'distinct:ignore_case'],
            'sizes.*.price' => ['required', 'integer', 'min:1', 'max:10000000'],
        ];
    }
}
```

`app/Http/Requests/Admin/UpdateMenuItemRequest.php`:

```php
<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\MenuItemSize;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMenuItemRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $menuItem = $this->route('menuItem');

        return $menuItem instanceof MenuItem && ($this->user()?->can('update', $menuItem) ?? false);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $menuItem = $this->route('menuItem');
        $menuItemId = $menuItem instanceof MenuItem ? $menuItem->id : 0;

        return [
            'category_id' => ['sometimes', 'required', 'integer', Rule::exists(Category::class, 'id')->withoutTrashed()],
            'name' => ['sometimes', 'required', 'string', 'max:80', Rule::unique(MenuItem::class, 'name')->ignore($menuItemId)],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'is_featured' => ['sometimes', 'boolean'],
            'sizes' => ['sometimes', 'required', 'array', 'min:1', 'max:6'],
            'sizes.*.id' => ['nullable', 'integer', 'distinct', Rule::exists(MenuItemSize::class, 'id')->where('menu_item_id', $menuItemId)],
            'sizes.*.name' => ['required', 'string', 'max:40', 'distinct:ignore_case'],
            'sizes.*.price' => ['required', 'integer', 'min:1', 'max:10000000'],
        ];
    }
}
```

- [ ] **Step 5: `app/Http/Controllers/Admin/MenuItemController.php`**

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListMenuItemsRequest;
use App\Http\Requests\Admin\MoveRequest;
use App\Http\Requests\Admin\StoreMenuItemRequest;
use App\Http\Requests\Admin\UpdateMenuItemRequest;
use App\Http\Resources\MenuItemResource;
use App\Models\AuditLog;
use App\Models\MenuItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class MenuItemController extends Controller
{
    /**
     * Items for the admin, optionally archived, filtered by category or searched by name.
     */
    public function index(ListMenuItemsRequest $request): AnonymousResourceCollection
    {
        $query = MenuItem::query()
            ->with(['category', 'sizes'])
            ->orderBy('category_id')
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($request->boolean('archived')) {
            $query->onlyTrashed();
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }

        $search = $request->string('search')->trim()->toString();

        if ($search !== '') {
            $query->whereLike('name', "%{$search}%");
        }

        return MenuItemResource::collection(
            $query->paginate($request->integer('per_page', 50))->withQueryString(),
        );
    }

    /**
     * One item, for the edit form.
     */
    public function show(MenuItem $menuItem): MenuItemResource
    {
        Gate::authorize('view', $menuItem);

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }

    /**
     * Add an item (available by default) at the end of its category.
     */
    public function store(StoreMenuItemRequest $request): JsonResponse
    {
        $menuItem = DB::transaction(function () use ($request): MenuItem {
            $menuItem = new MenuItem($request->safe()->only(['category_id', 'name', 'description', 'is_featured']));
            $menuItem->sort_order = $menuItem->nextSortOrder();
            $menuItem->save();

            $menuItem->syncSizes($request->validated('sizes'));

            AuditLog::record('menu_item.created', $menuItem, context: ['sizes' => $menuItem->priceList()]);

            return $menuItem;
        });

        return MenuItemResource::make($menuItem->load(['category', 'sizes']))->response()->setStatusCode(201);
    }

    /**
     * Change an item's details and sizes; price changes are audited with before and after.
     */
    public function update(UpdateMenuItemRequest $request, MenuItem $menuItem): MenuItemResource
    {
        DB::transaction(function () use ($request, $menuItem): void {
            $pricesBefore = $menuItem->priceList();

            $menuItem->fill($request->safe()->only(['category_id', 'name', 'description', 'is_featured']));

            if ($menuItem->isDirty('category_id')) {
                $menuItem->sort_order = $menuItem->nextSortOrder();
            }

            $menuItem->save();

            if ($request->has('sizes')) {
                $menuItem->syncSizes($request->validated('sizes'));
            }

            $pricesAfter = $menuItem->priceList();
            $priceChanges = $pricesBefore === $pricesAfter
                ? []
                : ['sizes' => ['from' => $pricesBefore, 'to' => $pricesAfter]];

            if ($menuItem->wasChanged() || $priceChanges !== []) {
                AuditLog::recordChange('menu_item.updated', $menuItem, extraChanges: $priceChanges);
            }
        });

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }

    /**
     * Archive an item; it leaves the menu but stays in order history.
     */
    public function destroy(MenuItem $menuItem): Response
    {
        Gate::authorize('delete', $menuItem);

        $menuItem->delete();
        AuditLog::record('menu_item.archived', $menuItem);

        return response()->noContent();
    }

    /**
     * Bring an archived item back.
     */
    public function restore(MenuItem $menuItem): MenuItemResource
    {
        Gate::authorize('restore', $menuItem);

        $menuItem->restore();
        AuditLog::record('menu_item.restored', $menuItem);

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }

    /**
     * Move an item one place up or down within its category.
     */
    public function move(MoveRequest $request, MenuItem $menuItem): Response
    {
        Gate::authorize('update', $menuItem);

        $menuItem->moveInSortOrder($request->string('direction')->toString());

        return response()->noContent();
    }
}
```

- [ ] **Step 6: Routes** — inside the `admin` group (import `App\Http\Controllers\Admin\MenuItemController`):

```php
            Route::get('/menu-items', [MenuItemController::class, 'index'])->name('menu-items.index');
            Route::post('/menu-items', [MenuItemController::class, 'store'])->name('menu-items.store');
            Route::get('/menu-items/{menuItem}', [MenuItemController::class, 'show'])->name('menu-items.show');
            Route::patch('/menu-items/{menuItem}', [MenuItemController::class, 'update'])->name('menu-items.update');
            Route::delete('/menu-items/{menuItem}', [MenuItemController::class, 'destroy'])->name('menu-items.destroy');
            Route::post('/menu-items/{menuItem}/restore', [MenuItemController::class, 'restore'])->withTrashed()->name('menu-items.restore');
            Route::post('/menu-items/{menuItem}/move', [MenuItemController::class, 'move'])->name('menu-items.move');
```

- [ ] **Step 7: Run (PASS)** — the test file, the full suite, PHPStan, Pint.

---

### Task 5: Photo pipeline

**Files:** `app/Services/MenuPhotoProcessor.php`, `app/Http/Requests/Admin/UpdateMenuItemPhotoRequest.php`, `app/Http/Controllers/Admin/MenuItemPhotoController.php`, `routes/api.php`, `tests/Feature/Catalog/MenuItemPhotoTest.php`.

**Interfaces — Produces:** `POST /api/v1/admin/menu-items/{menuItem}/photo` (multipart `photo`) → `MenuItemResource` with `image.{sm,md}`; `DELETE …/photo`. Files `menu-items/{Y}/{m}/{ulid}-400.webp` and `-800.webp` on the `public` disk. Audit `menu_item.photo_changed|photo_removed`.

- [ ] **Step 1: Failing test** — `tests/Feature/Catalog/MenuItemPhotoTest.php`

```php
<?php

use App\Models\MenuItem;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->admin = User::factory()->admin()->create();
    $this->item = MenuItem::factory()->create();
});

/**
 * A real JPEG with an EXIF (APP1) segment carrying a marker string, like a phone photo's GPS data.
 */
function jpegWithExifMarker(string $marker, int $width = 1200, int $height = 900): UploadedFile
{
    $image = imagecreatetruecolor($width, $height);
    ob_start();
    imagejpeg($image);
    $jpeg = (string) ob_get_clean();

    $payload = "Exif\0\0".$marker;
    $segment = "\xFF\xE1".pack('n', strlen($payload) + 2).$payload;

    return UploadedFile::fake()->createWithContent('phone.jpg', substr($jpeg, 0, 2).$segment.substr($jpeg, 2));
}

test('an uploaded photo becomes two square webp renditions without its exif data', function () {
    $response = $this->actingAs($this->admin)
        ->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", ['photo' => jpegWithExifMarker('GPS-SECRET-14.5995N')])
        ->assertOk();

    $path = $this->item->fresh()->image_path;

    foreach ([400, 800] as $edge) {
        $file = "{$path}-{$edge}.webp";
        Storage::disk('public')->assertExists($file);

        $contents = Storage::disk('public')->get($file);
        $info = getimagesizefromstring($contents);

        expect([$info[0], $info[1], $info['mime']])->toBe([$edge, $edge, 'image/webp'])
            ->and($contents)->not->toContain('GPS-SECRET');
    }

    $response->assertJsonPath('data.image.md', "/storage/{$path}-800.webp");
    $this->assertDatabaseHas('audit_logs', ['action' => 'menu_item.photo_changed', 'subject_id' => $this->item->id]);
});

test('replacing a photo deletes the old files', function () {
    $this->actingAs($this->admin)->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", [
        'photo' => UploadedFile::fake()->image('first.jpg', 1000, 1000),
    ])->assertOk();
    $oldPath = $this->item->fresh()->image_path;

    $this->actingAs($this->admin)->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", [
        'photo' => UploadedFile::fake()->image('second.png', 1000, 1000),
    ])->assertOk();

    Storage::disk('public')->assertMissing("{$oldPath}-400.webp");
    Storage::disk('public')->assertMissing("{$oldPath}-800.webp");
});

test('removing a photo deletes the files and clears the item', function () {
    $this->actingAs($this->admin)->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", [
        'photo' => UploadedFile::fake()->image('dish.jpg', 1000, 1000),
    ]);
    $path = $this->item->fresh()->image_path;

    $this->actingAs($this->admin)
        ->deleteJson("/api/v1/admin/menu-items/{$this->item->id}/photo")
        ->assertOk()
        ->assertJsonPath('data.image', null);

    Storage::disk('public')->assertMissing("{$path}-800.webp");
});

test('dangerous or unsuitable files are rejected before processing', function (Closure $makeFile) {
    $this->actingAs($this->admin)
        ->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", ['photo' => $makeFile()])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('photo');

    expect(Storage::disk('public')->allFiles())->toBeEmpty();
})->with([
    'php disguised as jpg' => fn () => UploadedFile::fake()->createWithContent('shell.jpg', '<?php system($_GET["c"]); ?>'),
    'gif' => fn () => UploadedFile::fake()->image('dish.gif', 1000, 1000),
    'too small' => fn () => UploadedFile::fake()->image('dish.jpg', 400, 400),
    'too large in pixels' => fn () => UploadedFile::fake()->image('dish.jpg', 5000, 800),
    'over 5 MB' => fn () => UploadedFile::fake()->create('dish.jpg', 6000, 'image/jpeg'),
]);

test('only admins change photos', function (string $role) {
    $this->actingAs(User::factory()->{$role}()->create())
        ->postJson("/api/v1/admin/menu-items/{$this->item->id}/photo", ['photo' => UploadedFile::fake()->image('dish.jpg', 1000, 1000)])
        ->assertForbidden();
})->with(['cashier', 'kitchen']);
```

- [ ] **Step 2: Run (FAIL)**.

- [ ] **Step 3: `app/Services/MenuPhotoProcessor.php`**

```php
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
```

- [ ] **Step 4: `app/Http/Requests/Admin/UpdateMenuItemPhotoRequest.php`**

```php
<?php

namespace App\Http\Requests\Admin;

use App\Models\MenuItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMenuItemPhotoRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $menuItem = $this->route('menuItem');

        return $menuItem instanceof MenuItem && ($this->user()?->can('update', $menuItem) ?? false);
    }

    /**
     * Content is sniffed (mimetypes), and the pixel size is read from the header
     * before anything is decoded, so decompression bombs never reach GD.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'photo' => [
                'required',
                'file',
                'max:5120',
                'mimetypes:image/jpeg,image/png,image/webp',
                'extensions:jpg,jpeg,png,webp',
                'dimensions:min_width=800,min_height=800,max_width=4096,max_height=4096',
            ],
        ];
    }
}
```

- [ ] **Step 5: `app/Http/Controllers/Admin/MenuItemPhotoController.php`**

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateMenuItemPhotoRequest;
use App\Http\Resources\MenuItemResource;
use App\Models\AuditLog;
use App\Models\MenuItem;
use App\Services\MenuPhotoProcessor;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Throwable;

class MenuItemPhotoController extends Controller
{
    public function __construct(private readonly MenuPhotoProcessor $photos) {}

    /**
     * Replace an item's photo with freshly processed renditions.
     */
    public function store(UpdateMenuItemPhotoRequest $request, MenuItem $menuItem): MenuItemResource
    {
        $photo = $request->file('photo');

        if (! $photo instanceof UploadedFile) {
            abort(422, 'A photo is required.');
        }

        $newPath = $this->photos->store($photo);
        $oldPath = $menuItem->image_path;

        try {
            $menuItem->forceFill(['image_path' => $newPath])->save();
        } catch (Throwable $exception) {
            $this->photos->delete($newPath);

            throw $exception;
        }

        if ($oldPath !== null) {
            $this->photos->delete($oldPath);
        }

        AuditLog::record('menu_item.photo_changed', $menuItem);

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }

    /**
     * Remove an item's photo.
     */
    public function destroy(MenuItem $menuItem): MenuItemResource
    {
        Gate::authorize('update', $menuItem);

        if ($menuItem->image_path !== null) {
            $this->photos->delete($menuItem->image_path);
            $menuItem->forceFill(['image_path' => null])->save();

            AuditLog::record('menu_item.photo_removed', $menuItem);
        }

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }
}
```

- [ ] **Step 6: Routes** — in the `admin` group (import `App\Http\Controllers\Admin\MenuItemPhotoController`):

```php
            Route::post('/menu-items/{menuItem}/photo', [MenuItemPhotoController::class, 'store'])->name('menu-items.photo.store');
            Route::delete('/menu-items/{menuItem}/photo', [MenuItemPhotoController::class, 'destroy'])->name('menu-items.photo.destroy');
```

- [ ] **Step 7: Run (PASS)** — the test file, the full suite, PHPStan, Pint. The user runs `php artisan storage:link` (creates `public/storage`).

---

### Task 6: "Ubos na" toggle for all staff + abilities

**Files:** `app/Http/Requests/UpdateMenuItemAvailabilityRequest.php`, `app/Http/Controllers/MenuItemAvailabilityController.php`, `app/Http/Controllers/CurrentUserController.php`, `routes/api.php`, `tests/Feature/Catalog/MenuAvailabilityTest.php`.

**Interfaces — Produces:** `PATCH /api/v1/menu-items/{menuItem}/availability` `{is_available: bool}` (`menu-items.availability.update`), audited as `menu_item.availability_changed`. `/me` → `abilities.manage_menu`, `abilities.update_availability`.

- [ ] **Step 1: Failing test** — `tests/Feature/Catalog/MenuAvailabilityTest.php`

```php
<?php

use App\Models\MenuItem;
use App\Models\User;

test('any staff role can mark an item sold out and available again', function (string $role) {
    $item = MenuItem::factory()->create();
    $staff = User::factory()->{$role}()->create();

    $this->actingAs($staff)
        ->patchJson("/api/v1/menu-items/{$item->id}/availability", ['is_available' => false])
        ->assertOk()
        ->assertJsonPath('data.is_available', false);

    $this->getJson('/api/v1/menu')->assertJsonPath('data.0.items.0.is_available', false);
    $this->assertDatabaseHas('audit_logs', [
        'action' => 'menu_item.availability_changed',
        'causer_id' => $staff->id,
        'subject_id' => $item->id,
    ]);

    $this->actingAs($staff)
        ->patchJson("/api/v1/menu-items/{$item->id}/availability", ['is_available' => true])
        ->assertJsonPath('data.is_available', true);
})->with(['admin', 'cashier', 'kitchen']);

test('guests and staff with a temporary password cannot toggle availability', function () {
    $item = MenuItem::factory()->create();

    $this->patchJson("/api/v1/menu-items/{$item->id}/availability", ['is_available' => false])->assertUnauthorized();

    $this->actingAs(User::factory()->kitchen()->mustChangePassword()->create())
        ->patchJson("/api/v1/menu-items/{$item->id}/availability", ['is_available' => false])
        ->assertForbidden();

    expect($item->fresh()->is_available)->toBeTrue();
});

test('archived items cannot be toggled', function () {
    $item = MenuItem::factory()->create();
    $item->delete();

    $this->actingAs(User::factory()->kitchen()->create())
        ->patchJson("/api/v1/menu-items/{$item->id}/availability", ['is_available' => false])
        ->assertNotFound();
});

test('the toggle only accepts a boolean', function () {
    $item = MenuItem::factory()->create();

    $this->actingAs(User::factory()->cashier()->create())
        ->patchJson("/api/v1/menu-items/{$item->id}/availability", ['is_available' => 'maybe'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('is_available');
});

test('the me endpoint tells each role what it may do with the menu', function (string $role, bool $manage) {
    $this->actingAs(User::factory()->{$role}()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.manage_menu', $manage)
        ->assertJsonPath('abilities.update_availability', true);
})->with([
    ['admin', true],
    ['cashier', false],
    ['kitchen', false],
]);
```

- [ ] **Step 2: Run (FAIL)**.

- [ ] **Step 3: `app/Http/Requests/UpdateMenuItemAvailabilityRequest.php`**

```php
<?php

namespace App\Http\Requests;

use App\Models\MenuItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMenuItemAvailabilityRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('updateAvailability', MenuItem::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'is_available' => ['required', 'boolean'],
        ];
    }
}
```

- [ ] **Step 4: `app/Http/Controllers/MenuItemAvailabilityController.php`**

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateMenuItemAvailabilityRequest;
use App\Http\Resources\MenuItemResource;
use App\Models\AuditLog;
use App\Models\MenuItem;

class MenuItemAvailabilityController extends Controller
{
    /**
     * Mark an item sold out ("Ubos na") or available again.
     */
    public function __invoke(UpdateMenuItemAvailabilityRequest $request, MenuItem $menuItem): MenuItemResource
    {
        $menuItem->is_available = $request->boolean('is_available');
        $menuItem->save();

        if ($menuItem->wasChanged('is_available')) {
            AuditLog::record('menu_item.availability_changed', $menuItem, context: ['is_available' => $menuItem->is_available]);
        }

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }
}
```

- [ ] **Step 5: Route** — inside the `password.changed` group, **outside** the `admin` prefix (import the controller):

```php
        Route::patch('/menu-items/{menuItem}/availability', MenuItemAvailabilityController::class)
            ->name('menu-items.availability.update');
```

- [ ] **Step 6: Abilities** — in `CurrentUserController`, import `App\Models\MenuItem` and extend `abilities`:

```php
            'abilities' => [
                'manage_staff' => $user->can('viewAny', User::class),
                'manage_menu' => $user->can('create', MenuItem::class),
                'update_availability' => $user->can('updateAvailability', MenuItem::class),
            ],
```

- [ ] **Step 7: Run (PASS)** — the test file, the full suite, PHPStan, Pint.
- [ ] **Step 8: Checkpoint commit** (backend of Module 2)

```bash
git add -A
git commit -m "feat: catalog API with sizes, photos, archive and sold-out toggle"
```

---

### Task 7: Frontend foundations — money, menu API client, types

**Files:** `resources/js/lib/money.ts`, `resources/js/lib/money.test.ts`, `resources/js/lib/http.ts` (DELETE + FormData), `resources/js/lib/menu.ts`, `resources/js/types/menu.ts`, `resources/js/types/index.ts`, `resources/js/types/auth.ts`, `vite.config.ts`, `package.json`.

**Interfaces — Produces:** `formatPeso(centavos)`, `parsePesoToCentavos(text): number|null`, `centavosToInput(centavos)`; `http.delete<T>()` and `FormData` bodies; menu API functions and loaders (`menuBoardLoader`, `menuItemFormLoader`, `categoriesLoader`, `archivedItemsLoader`); types `Category`, `MenuItem`, `MenuItemSize`, `MenuCategory`; `Abilities.manage_menu`, `Abilities.update_availability`; `npm run test` (Vitest via `vp test`).

- [ ] **Step 1: User runs** `npx shadcn@latest add textarea` (answer **No** to overwrites). Claude then points it at `@/lib/utils`, and the user runs `npm uninstall cn`.

- [ ] **Step 2: Test runner config** — in `vite.config.ts` add a top-level key:

```ts
    test: {
        include: ['resources/js/**/*.test.ts'],
    },
```

and in `package.json` → `scripts` add `"test": "vp test run",`.

- [ ] **Step 3: Failing unit test** — `resources/js/lib/money.test.ts`

```ts
import { describe, expect, it } from 'vite-plus/test';
import { centavosToInput, formatPeso, parsePesoToCentavos } from '@/lib/money';

describe('parsePesoToCentavos', () => {
    it.each([
        ['125', 12500],
        ['125.5', 12550],
        ['125.50', 12550],
        ['0.05', 5],
        ['1,250.75', 125075],
        ['₱ 99', 9900],
        ['  42.10 ', 4210],
    ])('reads %s as %i centavos', (input, expected) => {
        expect(parsePesoToCentavos(input)).toBe(expected);
    });

    it.each(['', 'abc', '12.345', '-5', '1e3', '12.', '.5', '1234567'])(
        'rejects %s',
        (input) => {
            expect(parsePesoToCentavos(input)).toBeNull();
        },
    );

    it('never drifts on amounts that break floating point', () => {
        expect(parsePesoToCentavos('0.29')).toBe(29);
        expect(parsePesoToCentavos('1.15')).toBe(115);
        expect(parsePesoToCentavos('4.35')).toBe(435);
    });
});

describe('centavosToInput', () => {
    it.each([
        [12550, '125.50'],
        [5, '0.05'],
        [100, '1.00'],
    ])('shows %i centavos as %s', (centavos, expected) => {
        expect(centavosToInput(centavos)).toBe(expected);
    });
});

describe('formatPeso', () => {
    it('formats centavos as pesos', () => {
        expect(formatPeso(12550)).toBe('₱125.50');
        expect(formatPeso(1250075)).toBe('₱12,500.75');
    });
});
```

- [ ] **Step 4: Run (FAIL)** — `npm run test` → cannot resolve `@/lib/money`.

- [ ] **Step 5: `resources/js/lib/money.ts`**

```ts
const pesoFormatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

/** Format integer centavos for display, e.g. 12550 → "₱125.50". */
export function formatPeso(centavos: number): string {
    return pesoFormatter.format(centavos / 100);
}

/**
 * Read what a person types ("125", "125.5", "1,250.50", "₱ 99") as integer
 * centavos using string arithmetic only, so floating point can never change a
 * price. Returns null for anything that is not a plain peso amount.
 */
export function parsePesoToCentavos(input: string): number | null {
    const cleaned = input.replace(/[₱,\s]/g, '');
    const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(cleaned);

    if (match === null) {
        return null;
    }

    const pesos = Number(match[1]);
    const centavos = Number((match[2] ?? '').padEnd(2, '0'));

    return pesos * 100 + centavos;
}

/** Show integer centavos in a price input, e.g. 12550 → "125.50". */
export function centavosToInput(centavos: number): string {
    const pesos = Math.floor(centavos / 100);
    const rest = String(centavos % 100).padStart(2, '0');

    return `${pesos}.${rest}`;
}
```

- [ ] **Step 6: Run (PASS)** — `npm run test`.

- [ ] **Step 7: `http.ts` — DELETE and file uploads.** Change `type Method` to include `'DELETE'`. In `send()`, replace the body/Content-Type handling with:

```ts
const isFormData = body instanceof FormData;

if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
}
```

and the `fetch` body line with:

```ts
        body:
            body === undefined
                ? undefined
                : isFormData
                  ? body
                  : JSON.stringify(body),
```

Then add `delete: <T>(url: string) => send<T>('DELETE', url),` to the exported `http` object.

- [ ] **Step 8: Types** — `resources/js/types/menu.ts`:

```ts
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
```

In `resources/js/types/index.ts` add `export type * from './menu';`. In `types/auth.ts`, `Abilities` becomes:

```ts
export type Abilities = {
    manage_staff: boolean;
    manage_menu: boolean;
    update_availability: boolean;
};
```

- [ ] **Step 9: `resources/js/lib/menu.ts`**

```ts
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
        {
            is_available: isAvailable,
        },
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
```

- [ ] **Step 10: Verify** — `npm run test`, `npm run types:check`, `npm run check` (`check:fix` for formatting).

---

### Task 8: Menu board (all staff) with the "Ubos na" switch

**Files:** `resources/js/components/confirm-dialog.tsx`, `resources/js/components/menu/plate-thumb.tsx`, `resources/js/components/menu/availability-switch.tsx`, `resources/js/pages/admin/menu/index.tsx`, `resources/js/layouts/admin-layout.tsx`, `resources/js/router.tsx`.

**Interfaces — Produces:** route `/admin/menu` (every staff role); the sidebar shows **Menu** when `abilities.update_availability`; `<ConfirmDialog title description confirmLabel onConfirm onClose />`; `<PlateThumb item />`; `<AvailabilitySwitch item onChanged />`.

- [ ] **Step 1: `resources/js/components/confirm-dialog.tsx`**

```tsx
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { HttpError } from '@/lib/http';

type ConfirmDialogProps = {
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
    onClose: () => void;
};

export function ConfirmDialog({
    title,
    description,
    confirmLabel,
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    const [isWorking, setIsWorking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleConfirm() {
        setIsWorking(true);
        setError(null);

        try {
            await onConfirm();
            onClose();
        } catch (caught) {
            setError(
                caught instanceof HttpError
                    ? caught.message
                    : 'Could not reach the server. Try again.',
            );
            setIsWorking(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={isWorking}
                        onClick={() => void handleConfirm()}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: `resources/js/components/menu/plate-thumb.tsx`**

```tsx
import type { MenuItem } from '@/types';

export function PlateThumb({ item }: { item: MenuItem }) {
    if (item.image === null) {
        return (
            <div
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted font-display text-lg font-extrabold text-muted-foreground"
            >
                {item.name.charAt(0)}
            </div>
        );
    }

    return (
        <img
            src={item.image.sm}
            alt={item.name}
            width={48}
            height={48}
            loading="lazy"
            className="size-12 shrink-0 rounded-full object-cover"
        />
    );
}
```

- [ ] **Step 3: `resources/js/components/menu/availability-switch.tsx`**

```tsx
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { setMenuItemAvailability } from '@/lib/menu';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

type AvailabilitySwitchProps = {
    item: MenuItem;
    onChanged: () => void;
};

export function AvailabilitySwitch({
    item,
    onChanged,
}: AvailabilitySwitchProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const id = `available-${item.id}`;

    async function handleChange(checked: boolean) {
        setIsSaving(true);
        setError(null);

        try {
            await setMenuItemAvailability(item.id, checked);
            onChanged();
        } catch {
            setError('Not saved. Try again.');
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Switch
                id={id}
                checked={item.is_available}
                disabled={isSaving}
                onCheckedChange={(checked) => void handleChange(checked)}
            />
            <Label
                htmlFor={id}
                className={cn(
                    'w-16 text-sm',
                    !item.is_available && 'font-semibold text-achuete',
                )}
            >
                {item.is_available ? 'Available' : 'Ubos na'}
            </Label>
            {error && (
                <span role="alert" className="text-xs text-destructive">
                    {error}
                </span>
            )}
        </div>
    );
}
```

- [ ] **Step 4: `resources/js/pages/admin/menu/index.tsx`**

```tsx
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';
import {
    Link,
    useLoaderData,
    useRevalidator,
    useRouteLoaderData,
} from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AvailabilitySwitch } from '@/components/menu/availability-switch';
import { PlateThumb } from '@/components/menu/plate-thumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { staffLoader } from '@/lib/auth';
import {
    archiveMenuItem,
    moveMenuItem,
    type Direction,
    type menuBoardLoader,
} from '@/lib/menu';
import { formatPeso } from '@/lib/money';
import type { MenuItem } from '@/types';

export default function MenuBoard() {
    const categories = useLoaderData<typeof menuBoardLoader>();
    const current = useRouteLoaderData<typeof staffLoader>('admin');
    const canManage = current?.abilities.manage_menu ?? false;
    const revalidator = useRevalidator();
    const [archiving, setArchiving] = useState<MenuItem | null>(null);
    const [moveError, setMoveError] = useState<string | null>(null);

    const refresh = () => void revalidator.revalidate();

    async function handleMove(item: MenuItem, direction: Direction) {
        setMoveError(null);

        try {
            await moveMenuItem(item.id, direction);
            refresh();
        } catch {
            setMoveError('Could not reorder. Try again.');
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl font-extrabold">
                        Menu
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {canManage
                            ? 'Manage dishes, prices and what is sold out.'
                            : 'Mark dishes "Ubos na" when they run out, and available again when they are back.'}
                    </p>
                </div>
                {canManage && (
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link to="/admin/menu/categories">Categories</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link to="/admin/menu/archived">Archived</Link>
                        </Button>
                        <Button asChild>
                            <Link to="/admin/menu/items/new">Add item</Link>
                        </Button>
                    </div>
                )}
            </div>

            {moveError && (
                <Alert variant="destructive">
                    <AlertDescription>{moveError}</AlertDescription>
                </Alert>
            )}

            {categories.length === 0 && (
                <p className="text-muted-foreground">
                    No menu items yet.
                    {canManage &&
                        ' Add a category first, then add items to it.'}
                </p>
            )}

            {categories.map((category) => (
                <section
                    key={category.id}
                    aria-labelledby={`category-${category.id}`}
                    className="flex flex-col gap-3"
                >
                    <h2
                        id={`category-${category.id}`}
                        className="font-display text-xl font-extrabold"
                    >
                        {category.name}
                    </h2>
                    <ul className="divide-y rounded-lg border bg-card">
                        {category.items.map((item, index) => (
                            <li
                                key={item.id}
                                className="flex flex-wrap items-center gap-4 p-3"
                            >
                                <PlateThumb item={item} />
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">
                                        {item.name}
                                        {item.is_featured && (
                                            <Badge className="ml-2 bg-achuete text-white">
                                                Featured
                                            </Badge>
                                        )}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.sizes
                                            .map(
                                                (size) =>
                                                    `${size.name} ${formatPeso(size.price)}`,
                                            )
                                            .join(' · ')}
                                    </p>
                                </div>
                                <AvailabilitySwitch
                                    item={item}
                                    onChanged={refresh}
                                />
                                {canManage && (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label={`Move ${item.name} up`}
                                            disabled={index === 0}
                                            onClick={() =>
                                                void handleMove(item, 'up')
                                            }
                                        >
                                            <ChevronUpIcon />
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label={`Move ${item.name} down`}
                                            disabled={
                                                index ===
                                                category.items.length - 1
                                            }
                                            onClick={() =>
                                                void handleMove(item, 'down')
                                            }
                                        >
                                            <ChevronDownIcon />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            asChild
                                        >
                                            <Link
                                                to={`/admin/menu/items/${item.id}/edit`}
                                            >
                                                Edit
                                            </Link>
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setArchiving(item)}
                                        >
                                            Archive
                                        </Button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            {archiving && (
                <ConfirmDialog
                    title={`Archive ${archiving.name}?`}
                    description="It disappears from the menu but stays in order history. You can restore it from Archived."
                    confirmLabel="Archive"
                    onConfirm={async () => {
                        await archiveMenuItem(archiving.id);
                        refresh();
                    }}
                    onClose={() => setArchiving(null)}
                />
            )}
        </div>
    );
}
```

- [ ] **Step 5: Sidebar + route** — in `admin-layout.tsx` add a **Menu** link between Dashboard and Staff:

```tsx
        {
            to: '/admin/menu',
            label: 'Menu',
            end: false,
            visible: abilities.update_availability,
        },
```

In `router.tsx`, import `MenuBoard` and `menuBoardLoader`, and add to the `/admin` children:

```tsx
            {
                path: 'menu',
                element: <MenuBoard />,
                loader: menuBoardLoader,
                errorElement: <RouteError />,
            },
```

- [ ] **Step 6: Verify** — `npm run types:check`, `npm run check`, `npm run build`.

---

### Task 9: Item form (create/edit) with sizes editor and photo

**Files:** `resources/js/pages/admin/menu/item-form.tsx`, `resources/js/components/menu/photo-field.tsx`, `resources/js/router.tsx`.

**Interfaces — Produces:** routes `/admin/menu/items/new` and `/admin/menu/items/:itemId/edit`. Creating an item redirects to its edit page (`?created=1`), where the photo can be added.

- [ ] **Step 1: `resources/js/components/menu/photo-field.tsx`**

```tsx
import { useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { HttpError } from '@/lib/http';
import { removeMenuItemPhoto, uploadMenuItemPhoto } from '@/lib/menu';
import type { MenuItem } from '@/types';

const MAX_BYTES = 5 * 1024 * 1024;

type PhotoFieldProps = {
    item: MenuItem;
    onChanged: () => void;
};

export function PhotoField({ item, onChanged }: PhotoFieldProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isWorking, setIsWorking] = useState(false);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0] ?? null;
        setError(null);

        if (selected && selected.size > MAX_BYTES) {
            setError('Photos must be 5 MB or smaller.');
            setFile(null);
            setPreviewUrl(null);

            return;
        }

        setFile(selected);
        setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
    }

    async function run(action: () => Promise<unknown>) {
        setIsWorking(true);
        setError(null);

        try {
            await action();
            setFile(null);
            setPreviewUrl(null);
            onChanged();
        } catch (caught) {
            setError(
                caught instanceof HttpError
                    ? (caught.errors.photo?.[0] ?? caught.message)
                    : 'Could not reach the server. Try again.',
            );
        } finally {
            setIsWorking(false);
        }
    }

    const shown = previewUrl ?? item.image?.md ?? null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Photo</CardTitle>
                <CardDescription>
                    Shown as a round plate. At least 800×800 pixels; JPG, PNG or
                    WebP; up to 5 MB. Location data is removed automatically.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-4">
                {shown ? (
                    <img
                        src={shown}
                        alt={item.name}
                        width={200}
                        height={200}
                        className="size-50 rounded-full object-cover"
                    />
                ) : (
                    <div className="flex size-50 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
                        No photo yet
                    </div>
                )}
                <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Choose a photo"
                    onChange={handleFileChange}
                />
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <div className="flex gap-2">
                    <Button
                        type="button"
                        disabled={!file || isWorking}
                        onClick={() => {
                            if (file) {
                                void run(() =>
                                    uploadMenuItemPhoto(item.id, file),
                                );
                            }
                        }}
                    >
                        {isWorking ? 'Saving…' : 'Upload photo'}
                    </Button>
                    {item.image && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isWorking}
                            onClick={() =>
                                void run(() => removeMenuItemPhoto(item.id))
                            }
                        >
                            Remove photo
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 2: `resources/js/pages/admin/menu/item-form.tsx`**

```tsx
import { XIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
    Link,
    useLoaderData,
    useNavigate,
    useRevalidator,
    useSearchParams,
} from 'react-router';
import { FormField } from '@/components/form-field';
import { PhotoField } from '@/components/menu/photo-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { HttpError, type ValidationErrors } from '@/lib/http';
import {
    createMenuItem,
    updateMenuItem,
    type MenuItemInput,
    type SizeInput,
    type menuItemFormLoader,
} from '@/lib/menu';
import { centavosToInput, parsePesoToCentavos } from '@/lib/money';
import type { Category, MenuItem, MenuItemSize } from '@/types';

type SizeRow = { key: string; id?: number; name: string; price: string };

let rowSequence = 0;

function newRow(size?: MenuItemSize, name = ''): SizeRow {
    rowSequence += 1;

    return {
        key: `size-${rowSequence}`,
        id: size?.id,
        name: size?.name ?? name,
        price: size ? centavosToInput(size.price) : '',
    };
}

export default function MenuItemFormPage() {
    const { categories, item } = useLoaderData<typeof menuItemFormLoader>();

    return (
        <MenuItemForm
            key={item?.id ?? 'new'}
            categories={categories}
            item={item}
        />
    );
}

function MenuItemForm({
    categories,
    item,
}: {
    categories: Category[];
    item: MenuItem | null;
}) {
    const navigate = useNavigate();
    const revalidator = useRevalidator();
    const [searchParams] = useSearchParams();
    const [name, setName] = useState(item?.name ?? '');
    const [categoryId, setCategoryId] = useState(
        item ? String(item.category_id) : '',
    );
    const [description, setDescription] = useState(item?.description ?? '');
    const [isFeatured, setIsFeatured] = useState(item?.is_featured ?? false);
    const [sizes, setSizes] = useState<SizeRow[]>(() =>
        item && item.sizes.length > 0
            ? item.sizes.map((size) => newRow(size))
            : [newRow(undefined, 'Regular')],
    );
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fieldError = (key: string): string | undefined => errors[key]?.[0];

    function updateRow(key: string, changes: Partial<SizeRow>) {
        setSizes((rows) =>
            rows.map((row) => (row.key === key ? { ...row, ...changes } : row)),
        );
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrors({});
        setFormError(null);

        const clientErrors: ValidationErrors = {};
        const parsedSizes: SizeInput[] = [];

        sizes.forEach((row, index) => {
            const price = parsePesoToCentavos(row.price);

            if (price === null) {
                clientErrors[`sizes.${index}.price`] = [
                    'Enter a price like 125 or 125.50.',
                ];
            } else {
                parsedSizes.push({
                    ...(row.id ? { id: row.id } : {}),
                    name: row.name,
                    price,
                });
            }
        });

        if (categoryId === '') {
            clientErrors.category_id = ['Choose a category.'];
        }

        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);

            return;
        }

        const payload: MenuItemInput = {
            category_id: Number(categoryId),
            name,
            description: description.trim() === '' ? null : description,
            is_featured: isFeatured,
            sizes: parsedSizes,
        };

        setIsSaving(true);

        try {
            if (item === null) {
                const created = await createMenuItem(payload);
                await navigate(
                    `/admin/menu/items/${created.data.id}/edit?created=1`,
                );
            } else {
                await updateMenuItem(item.id, payload);
                await navigate('/admin/menu');
            }
        } catch (error) {
            if (error instanceof HttpError && error.status === 422) {
                setErrors(error.errors);
            } else {
                setFormError(
                    error instanceof HttpError
                        ? error.message
                        : 'Could not reach the server. Try again.',
                );
            }
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
                <h1 className="font-display text-3xl font-extrabold">
                    {item === null ? 'Add item' : `Edit ${item.name}`}
                </h1>
                <Button asChild variant="outline">
                    <Link to="/admin/menu">Back to menu</Link>
                </Button>
            </div>

            {searchParams.get('created') === '1' && (
                <Alert>
                    <AlertDescription>
                        Saved. Add a photo below so it shows as a plate on the
                        menu.
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(event) => void handleSubmit(event)}
                        className="grid gap-5"
                    >
                        {formError && (
                            <Alert variant="destructive">
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        )}

                        <FormField
                            id="item-name"
                            label="Name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            error={fieldError('name')}
                            maxLength={80}
                            required
                        />

                        <div className="grid gap-2">
                            <Label htmlFor="item-category">Category</Label>
                            <Select
                                value={categoryId}
                                onValueChange={setCategoryId}
                            >
                                <SelectTrigger
                                    id="item-category"
                                    aria-invalid={
                                        fieldError('category_id')
                                            ? true
                                            : undefined
                                    }
                                >
                                    <SelectValue placeholder="Choose a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem
                                            key={category.id}
                                            value={String(category.id)}
                                        >
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldError('category_id') && (
                                <p className="text-sm text-destructive">
                                    {fieldError('category_id')}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="item-description">
                                Description
                            </Label>
                            <Textarea
                                id="item-description"
                                value={description}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                                maxLength={500}
                                rows={3}
                                aria-invalid={
                                    fieldError('description') ? true : undefined
                                }
                            />
                            {fieldError('description') && (
                                <p className="text-sm text-destructive">
                                    {fieldError('description')}
                                </p>
                            )}
                        </div>

                        <fieldset className="grid gap-3">
                            <legend className="text-sm font-medium">
                                Sizes and prices
                            </legend>
                            <p className="text-sm text-muted-foreground">
                                Keep one row if the item has a single price.
                            </p>
                            {sizes.map((row, index) => (
                                <div
                                    key={row.key}
                                    className="grid grid-cols-[1fr_8rem_auto] items-start gap-2"
                                >
                                    <div className="grid gap-1">
                                        <Input
                                            aria-label={`Size ${index + 1} name`}
                                            placeholder="Regular"
                                            value={row.name}
                                            onChange={(event) =>
                                                updateRow(row.key, {
                                                    name: event.target.value,
                                                })
                                            }
                                            maxLength={40}
                                            required
                                            aria-invalid={
                                                fieldError(
                                                    `sizes.${index}.name`,
                                                )
                                                    ? true
                                                    : undefined
                                            }
                                        />
                                        {fieldError(`sizes.${index}.name`) && (
                                            <p className="text-sm text-destructive">
                                                {fieldError(
                                                    `sizes.${index}.name`,
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-1">
                                        <Input
                                            aria-label={`Size ${index + 1} price in pesos`}
                                            inputMode="decimal"
                                            placeholder="125.00"
                                            value={row.price}
                                            onChange={(event) =>
                                                updateRow(row.key, {
                                                    price: event.target.value,
                                                })
                                            }
                                            required
                                            aria-invalid={
                                                fieldError(
                                                    `sizes.${index}.price`,
                                                )
                                                    ? true
                                                    : undefined
                                            }
                                        />
                                        {fieldError(`sizes.${index}.price`) && (
                                            <p className="text-sm text-destructive">
                                                {fieldError(
                                                    `sizes.${index}.price`,
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Remove size ${index + 1}`}
                                        disabled={sizes.length === 1}
                                        onClick={() =>
                                            setSizes((rows) =>
                                                rows.filter(
                                                    (candidate) =>
                                                        candidate.key !==
                                                        row.key,
                                                ),
                                            )
                                        }
                                    >
                                        <XIcon />
                                    </Button>
                                </div>
                            ))}
                            {fieldError('sizes') && (
                                <p className="text-sm text-destructive">
                                    {fieldError('sizes')}
                                </p>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-fit"
                                disabled={sizes.length >= 6}
                                onClick={() =>
                                    setSizes((rows) => [...rows, newRow()])
                                }
                            >
                                Add size
                            </Button>
                        </fieldset>

                        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                            <Label htmlFor="item-featured">
                                Featured in the "Nasa kalan" hero
                            </Label>
                            <Switch
                                id="item-featured"
                                checked={isFeatured}
                                onCheckedChange={setIsFeatured}
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-fit"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving…' : 'Save item'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {item !== null && (
                <PhotoField
                    item={item}
                    onChanged={() => void revalidator.revalidate()}
                />
            )}
        </div>
    );
}
```

- [ ] **Step 3: Routes** — in `router.tsx` import `MenuItemFormPage` and `menuItemFormLoader`, and add to the `/admin` children:

```tsx
            {
                path: 'menu/items/new',
                element: <MenuItemFormPage />,
                loader: menuItemFormLoader,
                errorElement: <RouteError />,
            },
            {
                path: 'menu/items/:itemId/edit',
                element: <MenuItemFormPage />,
                loader: menuItemFormLoader,
                errorElement: <RouteError />,
            },
```

- [ ] **Step 4: Verify** — `npm run types:check`, `npm run check`, `npm run build`.

---

### Task 10: Categories page + archived items page

**Files:** `resources/js/components/menu/category-form-dialog.tsx`, `resources/js/pages/admin/menu/categories.tsx`, `resources/js/pages/admin/menu/archived.tsx`, `resources/js/router.tsx`.

**Interfaces — Produces:** routes `/admin/menu/categories` and `/admin/menu/archived`.

- [ ] **Step 1: `resources/js/components/menu/category-form-dialog.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { HttpError, type ValidationErrors } from '@/lib/http';
import { createCategory, updateCategory } from '@/lib/menu';
import type { Category } from '@/types';

type CategoryFormDialogProps = {
    category: Category | null;
    onClose: () => void;
    onSaved: () => void;
};

export function CategoryFormDialog({
    category,
    onClose,
    onSaved,
}: CategoryFormDialogProps) {
    const [name, setName] = useState(category?.name ?? '');
    const [description, setDescription] = useState(category?.description ?? '');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSaving(true);
        setErrors({});
        setFormError(null);

        const input = {
            name,
            description: description.trim() === '' ? null : description,
        };

        try {
            if (category === null) {
                await createCategory(input);
            } else {
                await updateCategory(category.id, input);
            }

            onSaved();
            onClose();
        } catch (error) {
            if (error instanceof HttpError && error.status === 422) {
                setErrors(error.errors);
            } else {
                setFormError(
                    error instanceof HttpError
                        ? error.message
                        : 'Could not reach the server. Try again.',
                );
            }
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent>
                <form
                    onSubmit={(event) => void handleSubmit(event)}
                    className="grid gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>
                            {category === null
                                ? 'Add category'
                                : `Edit ${category.name}`}
                        </DialogTitle>
                    </DialogHeader>
                    {formError && (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}
                    <FormField
                        id="category-name"
                        label="Name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        error={errors.name?.[0]}
                        maxLength={60}
                        required
                    />
                    <FormField
                        id="category-description"
                        label="Description (optional)"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        error={errors.description?.[0]}
                        maxLength={255}
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: `resources/js/pages/admin/menu/categories.tsx`**

```tsx
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CategoryFormDialog } from '@/components/menu/category-form-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { HttpError } from '@/lib/http';
import {
    archiveCategory,
    moveCategory,
    restoreCategory,
    type categoriesLoader,
} from '@/lib/menu';
import type { Category } from '@/types';

export default function Categories() {
    const { active, archived } = useLoaderData<typeof categoriesLoader>();
    const revalidator = useRevalidator();
    const [isCreating, setIsCreating] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);
    const [archiving, setArchiving] = useState<Category | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const refresh = () => void revalidator.revalidate();

    async function run(action: () => Promise<unknown>) {
        setActionError(null);

        try {
            await action();
            refresh();
        } catch (error) {
            setActionError(
                error instanceof HttpError
                    ? error.message
                    : 'Could not reach the server. Try again.',
            );
        }
    }

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="font-display text-3xl font-extrabold">
                    Categories
                </h1>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link to="/admin/menu">Back to menu</Link>
                    </Button>
                    <Button onClick={() => setIsCreating(true)}>
                        Add category
                    </Button>
                </div>
            </div>

            {actionError && (
                <Alert variant="destructive">
                    <AlertDescription>{actionError}</AlertDescription>
                </Alert>
            )}

            <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {active.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={3}
                                    className="py-8 text-center text-muted-foreground"
                                >
                                    No categories yet. Add Meals, Snacks,
                                    Drinks…
                                </TableCell>
                            </TableRow>
                        )}
                        {active.map((category, index) => (
                            <TableRow key={category.id}>
                                <TableCell className="font-medium">
                                    {category.name}
                                </TableCell>
                                <TableCell>
                                    {category.items_count ?? 0}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label={`Move ${category.name} up`}
                                            disabled={index === 0}
                                            onClick={() =>
                                                void run(() =>
                                                    moveCategory(
                                                        category.id,
                                                        'up',
                                                    ),
                                                )
                                            }
                                        >
                                            <ChevronUpIcon />
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label={`Move ${category.name} down`}
                                            disabled={
                                                index === active.length - 1
                                            }
                                            onClick={() =>
                                                void run(() =>
                                                    moveCategory(
                                                        category.id,
                                                        'down',
                                                    ),
                                                )
                                            }
                                        >
                                            <ChevronDownIcon />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditing(category)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                setArchiving(category)
                                            }
                                        >
                                            Archive
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {archived.length > 0 && (
                <section
                    className="flex flex-col gap-3"
                    aria-labelledby="archived-categories"
                >
                    <h2
                        id="archived-categories"
                        className="font-display text-xl font-extrabold"
                    >
                        Archived
                    </h2>
                    <ul className="divide-y rounded-lg border bg-card">
                        {archived.map((category) => (
                            <li
                                key={category.id}
                                className="flex items-center justify-between gap-4 p-3"
                            >
                                <span>{category.name}</span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        void run(() =>
                                            restoreCategory(category.id),
                                        )
                                    }
                                >
                                    Restore
                                </Button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {isCreating && (
                <CategoryFormDialog
                    category={null}
                    onClose={() => setIsCreating(false)}
                    onSaved={refresh}
                />
            )}
            {editing && (
                <CategoryFormDialog
                    key={editing.id}
                    category={editing}
                    onClose={() => setEditing(null)}
                    onSaved={refresh}
                />
            )}
            {archiving && (
                <ConfirmDialog
                    title={`Archive ${archiving.name}?`}
                    description="The category and all of its items disappear from the menu. Nothing is deleted, so you can restore it later."
                    confirmLabel="Archive"
                    onConfirm={async () => {
                        await archiveCategory(archiving.id);
                        refresh();
                    }}
                    onClose={() => setArchiving(null)}
                />
            )}
        </div>
    );
}
```

- [ ] **Step 3: `resources/js/pages/admin/menu/archived.tsx`**

```tsx
import { useState } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';
import { PlateThumb } from '@/components/menu/plate-thumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { HttpError } from '@/lib/http';
import { restoreMenuItem, type archivedItemsLoader } from '@/lib/menu';

const archivedFormat = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
});

export default function ArchivedItems() {
    const items = useLoaderData<typeof archivedItemsLoader>();
    const revalidator = useRevalidator();
    const [error, setError] = useState<string | null>(null);

    async function handleRestore(id: number) {
        setError(null);

        try {
            await restoreMenuItem(id);
            void revalidator.revalidate();
        } catch (caught) {
            setError(
                caught instanceof HttpError
                    ? caught.message
                    : 'Could not reach the server. Try again.',
            );
        }
    }

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="font-display text-3xl font-extrabold">
                    Archived items
                </h1>
                <Button asChild variant="outline">
                    <Link to="/admin/menu">Back to menu</Link>
                </Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {items.length === 0 ? (
                <p className="text-muted-foreground">Nothing is archived.</p>
            ) : (
                <ul className="divide-y rounded-lg border bg-card">
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className="flex flex-wrap items-center gap-4 p-3"
                        >
                            <PlateThumb item={item} />
                            <div className="min-w-0 flex-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {item.category_name}
                                    {item.archived_at &&
                                        ` · archived ${archivedFormat.format(new Date(item.archived_at))}`}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleRestore(item.id)}
                            >
                                Restore
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Routes** — in `router.tsx` import both pages and their loaders, and add to the `/admin` children:

```tsx
            {
                path: 'menu/categories',
                element: <Categories />,
                loader: categoriesLoader,
                errorElement: <RouteError />,
            },
            {
                path: 'menu/archived',
                element: <ArchivedItems />,
                loader: archivedItemsLoader,
                errorElement: <RouteError />,
            },
```

- [ ] **Step 5: Verify** — `npm run test`, `npm run types:check`, `npm run check`, `npm run build`.

- [ ] **Step 6: Browser walkthrough** (`composer run dev`, after `php artisan storage:link`):
    1. As admin: **Menu → Categories** → add Meals, Snacks, Drinks; move Drinks up/down.
    2. **Add item**: "Iced Coffee" in Drinks with sizes 12oz `90` and 16oz `110.50`, then a bad price (`12.345`) → inline error.
    3. You land on the edit page → upload a phone photo (portrait) → it shows upright, as a circle.
    4. Back on the Menu: the prices show as ₱90.00 · ₱110.50; flip **Available** → "Ubos na".
    5. Log in as a kitchen/cashier demo account: **Menu** shows only the switches (no Edit/Archive/Add).
    6. Archive an item → it appears under **Archived** → Restore.

- [ ] **Step 7: Checkpoint commit**

```bash
git add -A
git commit -m "feat: menu board, item form with sizes and photos, categories UI"
```

---

### Task 11: Module 2 gate

- [ ] `composer audit`; `npm audit --audit-level=high` → clean.
- [ ] `composer run test` → Pint, PHPStan, Pest all pass; `npm run test && npm run check && npm run types:check` → pass.
- [ ] `php artisan route:list --except-vendor -v` → admin catalog routes carry `role:admin`; the availability route carries `auth:sanctum`, `active` and `password.changed` (no role); `GET api/v1/menu` has only `api`.
- [ ] Security grep (`$request->all()`, `guarded = []`, `whereRaw`, `{!!`, `dangerouslySetInnerHTML`) → nothing.
- [ ] Production CSP check: stop dev, remove `public/hot`, `npm run build`, `php artisan serve` → photos, dialogs and selects work with no CSP errors.
- [ ] Final commit: `git commit -m "chore: Module 2 catalog passes full checks"`.
