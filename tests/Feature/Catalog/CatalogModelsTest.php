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
