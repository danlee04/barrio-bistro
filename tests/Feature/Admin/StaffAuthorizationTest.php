<?php

use App\Models\User;

test('admins can list staff', function () {
    $admin = User::factory()->admin()->create();
    User::factory()->cashier()->count(2)->create();

    $this->actingAs($admin)
        ->getJson('/api/v1/admin/staff')
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonStructure([
            'data' => [['id', 'name', 'email', 'role', 'is_active']],
            'meta' => ['current_page', 'last_page', 'total'],
        ]);
});

test('cashier and kitchen staff cannot list staff', function (string $role) {
    $this->actingAs(User::factory()->{$role}()->create())
        ->getJson('/api/v1/admin/staff')
        ->assertForbidden();
})->with(['cashier', 'kitchen']);

test('guests cannot list staff', function () {
    $this->getJson('/api/v1/admin/staff')->assertUnauthorized();
});

test('a deactivated admin loses admin powers', function () {
    $this->actingAs(User::factory()->admin()->inactive()->create())
        ->getJson('/api/v1/admin/staff')
        ->assertUnauthorized();
});

test('the staff list can be searched and filtered by role', function () {
    $admin = User::factory()->admin()->create(['name' => 'Ana Admin']);
    User::factory()->cashier()->create(['name' => 'Carlo Cashier']);
    User::factory()->kitchen()->create(['name' => 'Kiko Kitchen']);

    $this->actingAs($admin)->getJson('/api/v1/admin/staff?search=Carlo')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Carlo Cashier');

    $this->actingAs($admin)->getJson('/api/v1/admin/staff?role=kitchen')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Kiko Kitchen');
});

test('page size is capped', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/admin/staff?per_page=500')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('per_page');
});

test('the me endpoint tells admins they can manage staff', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.manage_staff', true);
});
