<?php

use App\Models\AuditLog;
use App\Models\User;

test('deactivated staff cannot log in and see the same message as a wrong password', function () {
    $staff = User::factory()->inactive()->create();

    $this->postJson('/login', ['email' => $staff->email, 'password' => 'password'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email' => __('auth.failed')]);

    $this->assertGuest();
});

test('a successful login stamps the time and is audited', function () {
    $staff = User::factory()->create();

    $this->postJson('/login', ['email' => $staff->email, 'password' => 'password'])->assertNoContent();

    expect($staff->fresh()->last_login_at)->not->toBeNull();
    $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login', 'causer_id' => $staff->id]);
});

test('a failed login is audited with the email but never the password', function () {
    $this->postJson('/login', ['email' => 'someone@example.com', 'password' => 'wrong-password-123'])
        ->assertUnprocessable();

    $log = AuditLog::query()->where('action', 'auth.failed')->sole();

    expect($log->context)->toBe(['email' => 'someone@example.com'])
        ->and(json_encode($log->toArray()))->not->toContain('wrong-password-123');
});

test('the me endpoint returns the profile without secrets', function () {
    $staff = User::factory()->cashier()->create();

    $this->actingAs($staff)
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('data.email', $staff->email)
        ->assertJsonPath('data.role', 'cashier')
        ->assertJsonPath('data.role_label', 'Cashier')
        ->assertJsonPath('abilities.manage_staff', false)
        ->assertJsonMissingPath('data.password')
        ->assertJsonMissingPath('data.remember_token');
});

test('a deactivated staff member is signed out on their next request', function () {
    $staff = User::factory()->create();
    $this->actingAs($staff);
    $staff->forceFill(['is_active' => false])->save();

    $this->getJson('/api/v1/me')
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Your account has been deactivated.');

    $this->assertGuest('web');
});

test('email verification endpoints are gone', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/email/verification-notification')
        ->assertMethodNotAllowed();
});
