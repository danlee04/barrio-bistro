<?php

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

test('an admin can add staff with a temporary password', function () {
    $this->actingAs($this->admin)->postJson('/api/v1/admin/staff', [
        'name' => 'Carlo Cruz',
        'email' => 'Carlo@Example.com',
        'role' => 'cashier',
        'password' => 'temporary-passphrase',
        'password_confirmation' => 'temporary-passphrase',
    ])
        ->assertCreated()
        ->assertJsonPath('data.email', 'carlo@example.com')
        ->assertJsonPath('data.role', 'cashier')
        ->assertJsonPath('data.must_change_password', true);

    $staff = User::query()->where('email', 'carlo@example.com')->sole();

    expect(Hash::check('temporary-passphrase', $staff->password))->toBeTrue();
    $this->assertDatabaseHas('audit_logs', [
        'action' => 'staff.created',
        'subject_id' => $staff->id,
        'causer_id' => $this->admin->id,
    ]);
});

test('new staff need a unique email, a known role and a strong password', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    $this->actingAs($this->admin)->postJson('/api/v1/admin/staff', [
        'name' => 'Someone',
        'email' => 'taken@example.com',
        'role' => 'owner',
        'password' => 'short',
        'password_confirmation' => 'short',
    ])->assertUnprocessable()->assertJsonValidationErrors(['email', 'role', 'password']);
});

test('an admin can change a role and deactivate an account', function () {
    $staff = User::factory()->cashier()->create();

    $this->actingAs($this->admin)
        ->patchJson("/api/v1/admin/staff/{$staff->id}", ['role' => 'kitchen', 'is_active' => false])
        ->assertOk()
        ->assertJsonPath('data.role', 'kitchen')
        ->assertJsonPath('data.is_active', false);

    $log = AuditLog::query()->where('action', 'staff.updated')->sole();

    expect($log->changes)->toMatchArray(['role' => ['from' => 'cashier', 'to' => 'kitchen']])
        ->and($log->changes)->toHaveKey('is_active');
});

test('an admin cannot demote or deactivate themselves', function () {
    $this->actingAs($this->admin)
        ->patchJson("/api/v1/admin/staff/{$this->admin->id}", ['role' => 'cashier', 'is_active' => false])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['role', 'is_active']);

    $fresh = $this->admin->fresh();

    expect($fresh->role)->toBe(Role::Admin)
        ->and($fresh->is_active)->toBeTrue();
});

test('non-admins cannot add staff or promote themselves', function () {
    $cashier = User::factory()->cashier()->create();

    $this->actingAs($cashier)->postJson('/api/v1/admin/staff', [
        'name' => 'Sneaky',
        'email' => 'sneaky@example.com',
        'role' => 'admin',
        'password' => 'temporary-passphrase',
        'password_confirmation' => 'temporary-passphrase',
    ])->assertForbidden();

    $this->actingAs($cashier)
        ->patchJson("/api/v1/admin/staff/{$cashier->id}", ['role' => 'admin'])
        ->assertForbidden();

    expect($cashier->fresh()->role)->toBe(Role::Cashier)
        ->and(User::query()->where('email', 'sneaky@example.com')->exists())->toBeFalse();
});

test('an admin can reset a staff password, which forces a change at next login', function () {
    $staff = User::factory()->create();

    $this->actingAs($this->admin)->putJson("/api/v1/admin/staff/{$staff->id}/password", [
        'password' => 'another-temporary-pass',
        'password_confirmation' => 'another-temporary-pass',
    ])->assertNoContent();

    $staff->refresh();

    expect(Hash::check('another-temporary-pass', $staff->password))->toBeTrue()
        ->and($staff->must_change_password)->toBeTrue();
    $this->assertDatabaseHas('audit_logs', ['action' => 'staff.password_reset', 'subject_id' => $staff->id]);
});

test('resetting a password signs the staff member out of existing sessions', function () {
    $staff = User::factory()->create();
    $oldSessionHash = auth()->guard('web')->hashPasswordForCookie($staff->password);

    $this->actingAs($this->admin)->putJson("/api/v1/admin/staff/{$staff->id}/password", [
        'password' => 'another-temporary-pass',
        'password_confirmation' => 'another-temporary-pass',
    ])->assertNoContent();

    $this->actingAs($staff->fresh())
        ->withSession(['password_hash_web' => $oldSessionHash])
        ->withHeader('Referer', config('app.url'))
        ->getJson('/api/v1/me')
        ->assertUnauthorized();
});

test('admins change their own password on the change-password page, not here', function () {
    $this->actingAs($this->admin)->putJson("/api/v1/admin/staff/{$this->admin->id}/password", [
        'password' => 'another-temporary-pass',
        'password_confirmation' => 'another-temporary-pass',
    ])->assertUnprocessable()->assertJsonValidationErrors('password');
});
