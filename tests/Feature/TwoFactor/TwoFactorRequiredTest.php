<?php

use App\Models\User;

test('an admin without a second factor cannot open the admin', function () {
    $admin = User::factory()->admin()->withoutTwoFactor()->create();

    $this->actingAs($admin)
        ->getJson('/api/v1/admin/reports/summary')
        ->assertForbidden()
        ->assertJsonPath('code', 'two_factor_required');
});

test('that admin can still reach what they need to turn it on', function () {
    $admin = User::factory()->admin()->withoutTwoFactor()->create();

    $this->actingAs($admin)->getJson('/api/v1/me')->assertOk();
    $this->actingAs($admin)->getJson('/api/v1/me/two-factor')->assertOk();
    $this->actingAs($admin)->postJson('/api/v1/me/two-factor')->assertOk();
});

test('an admin with it on works as before', function () {
    $admin = User::factory()->admin()->withTwoFactor()->create();

    $this->actingAs($admin)->getJson('/api/v1/admin/reports/summary')->assertOk();
});

test('the counter is not held to it, because the tablet is shared', function () {
    foreach (['cashier', 'kitchen'] as $role) {
        $staff = User::factory()->{$role}()->create();

        $this->actingAs($staff)->getJson('/api/v1/staff/orders')->assertOk();
    }
});

test('the user payload says whether it is on and whether it is required', function () {
    $cashier = User::factory()->cashier()->create();

    $this->actingAs($cashier)
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('two_factor', ['enabled' => false, 'required' => false]);
});
