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
