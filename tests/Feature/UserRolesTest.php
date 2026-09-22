<?php

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\MassAssignmentException;

test('staff roles are stored as the Role enum', function (string $state, Role $role) {
    $user = User::factory()->{$state}()->create();

    expect($user->fresh()->role)->toBe($role)
        ->and($user->hasRole($role))->toBeTrue();
})->with([
    'admin' => ['admin', Role::Admin],
    'cashier' => ['cashier', Role::Cashier],
    'kitchen' => ['kitchen', Role::Kitchen],
]);

test('new staff are active with no forced password change', function () {
    $user = User::factory()->create()->fresh();

    expect($user->is_active)->toBeTrue()
        ->and($user->must_change_password)->toBeFalse()
        ->and($user->last_login_at)->toBeNull();
});

test('privilege columns cannot be mass assigned', function (string $column, mixed $value) {
    expect(fn () => new User(['name' => 'Juan', $column => $value]))
        ->toThrow(MassAssignmentException::class);
})->with([
    'role' => ['role', 'admin'],
    'is_active' => ['is_active', true],
    'must_change_password' => ['must_change_password', false],
]);

test('only the admin role counts as admin', function () {
    expect(User::factory()->admin()->make()->isAdmin())->toBeTrue()
        ->and(User::factory()->cashier()->make()->isAdmin())->toBeFalse();
});

test('the active scope leaves out deactivated staff', function () {
    $active = User::factory()->create();
    User::factory()->inactive()->create();

    expect(User::query()->active()->pluck('id')->all())->toBe([$active->id]);
});
