<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('staff with a temporary password are blocked from everything but changing it', function () {
    $admin = User::factory()->admin()->mustChangePassword()->create();

    $this->actingAs($admin)->getJson('/api/v1/admin/staff')
        ->assertForbidden()
        ->assertJsonPath('code', 'password_change_required');

    $this->actingAs($admin)->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('data.must_change_password', true);
});

test('changing the password requires the current one', function () {
    $this->actingAs(User::factory()->create())->putJson('/api/v1/me/password', [
        'current_password' => 'not-my-password',
        'password' => 'a-brand-new-passphrase',
        'password_confirmation' => 'a-brand-new-passphrase',
    ])->assertUnprocessable()->assertJsonValidationErrors('current_password');
});

test('the new password must be strong and different', function () {
    $this->actingAs(User::factory()->create())->putJson('/api/v1/me/password', [
        'current_password' => 'password',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertUnprocessable()->assertJsonValidationErrors('password');
});

test('changing the password clears the temporary flag and is audited', function () {
    $staff = User::factory()->mustChangePassword()->create();

    $this->actingAs($staff)->putJson('/api/v1/me/password', [
        'current_password' => 'password',
        'password' => 'a-brand-new-passphrase',
        'password_confirmation' => 'a-brand-new-passphrase',
    ])->assertNoContent();

    $staff->refresh();

    expect($staff->must_change_password)->toBeFalse()
        ->and(Hash::check('a-brand-new-passphrase', $staff->password))->toBeTrue();
    $this->assertDatabaseHas('audit_logs', ['action' => 'auth.password_changed', 'causer_id' => $staff->id]);
});

test('password change attempts are rate limited', function () {
    $staff = User::factory()->create();
    $attempt = [
        'current_password' => 'wrong-password',
        'password' => 'a-brand-new-passphrase',
        'password_confirmation' => 'a-brand-new-passphrase',
    ];

    foreach (range(1, 6) as $try) {
        $this->actingAs($staff)->putJson('/api/v1/me/password', $attempt)->assertUnprocessable();
    }

    $this->actingAs($staff)->putJson('/api/v1/me/password', $attempt)->assertTooManyRequests();
});
