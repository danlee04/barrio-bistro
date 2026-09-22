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

/**
 * A valid "add item" payload for the given category, with optional overrides.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
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
