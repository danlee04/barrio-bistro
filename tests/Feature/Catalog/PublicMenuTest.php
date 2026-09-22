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
