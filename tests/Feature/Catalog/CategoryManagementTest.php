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
