<?php

use App\Models\AuditLog;
use App\Models\User;
use PragmaRX\Google2FA\Google2FA;

function currentCode(string $secret): string
{
    return app(Google2FA::class)->getCurrentOtp($secret);
}

test('setting up hands over a secret and a QR to scan', function () {
    $admin = User::factory()->admin()->withoutTwoFactor()->create();

    $response = $this->actingAs($admin)
        ->postJson('/api/v1/me/two-factor')
        ->assertOk();

    $secret = $response->json('data.secret');

    expect($secret)->toBeString()->toHaveLength(32)
        ->and($response->json('data.qr'))->toStartWith('data:image/svg+xml;base64,')
        ->and($response->json('data.uri'))->toContain('otpauth://totp/');

    // Nothing is switched on until a code comes back.
    expect($admin->fresh()->hasTwoFactorEnabled())->toBeFalse();
});

test('a half-finished setup never locks anybody out', function () {
    // A secret with nothing confirmed: the shop walked away mid-setup.
    $admin = User::factory()->admin()->withoutTwoFactor()->create([
        'two_factor_secret' => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    ]);

    $this->postJson('/login', [
        'email' => $admin->email,
        'password' => 'password',
    ])->assertNoContent();

    $this->assertAuthenticatedAs($admin);
});

test('the right code switches it on and shows the recovery codes once', function () {
    $admin = User::factory()->admin()->withoutTwoFactor()->create();

    $secret = $this->actingAs($admin)
        ->postJson('/api/v1/me/two-factor')
        ->json('data.secret');

    $response = $this->actingAs($admin)
        ->postJson('/api/v1/me/two-factor/confirm', ['code' => currentCode($secret)])
        ->assertOk();

    $codes = $response->json('data.recovery_codes');

    expect($codes)->toHaveCount(8)
        ->and($admin->fresh()->hasTwoFactorEnabled())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'two_factor.enabled')->count())->toBe(1);

    // Stored hashed, never in the clear.
    foreach ($admin->fresh()->two_factor_recovery_codes as $stored) {
        expect($codes)->not->toContain($stored);
    }
});

test('a wrong code switches nothing on', function () {
    $admin = User::factory()->admin()->withoutTwoFactor()->create();

    $this->actingAs($admin)->postJson('/api/v1/me/two-factor')->assertOk();

    $this->actingAs($admin)
        ->postJson('/api/v1/me/two-factor/confirm', ['code' => '000000'])
        ->assertJsonValidationErrors(['code']);

    expect($admin->fresh()->hasTwoFactorEnabled())->toBeFalse();
});

test('turning it off needs the password again', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->deleteJson('/api/v1/me/two-factor', ['password' => 'wrong-password'])
        ->assertJsonValidationErrors(['password']);

    expect($admin->fresh()->hasTwoFactorEnabled())->toBeTrue();

    $this->actingAs($admin)
        ->deleteJson('/api/v1/me/two-factor', ['password' => 'password'])
        ->assertNoContent();

    expect($admin->fresh()->hasTwoFactorEnabled())->toBeFalse()
        ->and(AuditLog::query()->where('action', 'two_factor.disabled')->count())->toBe(1);
});

test('replacing the recovery codes needs the password too', function () {
    $admin = User::factory()->admin()->create();
    $before = $admin->two_factor_recovery_codes;

    $this->actingAs($admin)
        ->postJson('/api/v1/me/two-factor/recovery-codes', ['password' => 'nope'])
        ->assertJsonValidationErrors(['password']);

    $codes = $this->actingAs($admin)
        ->postJson('/api/v1/me/two-factor/recovery-codes', ['password' => 'password'])
        ->assertOk()
        ->json('data.recovery_codes');

    expect($codes)->toHaveCount(8)
        ->and($admin->fresh()->two_factor_recovery_codes)->not->toBe($before);
});

test('the secret never leaves in the user payload', function () {
    $admin = User::factory()->admin()->create();

    $body = $this->actingAs($admin)->getJson('/api/v1/me')->assertOk()->content();

    expect($body)->not->toContain($admin->two_factor_secret)
        ->and(json_decode($body, true)['two_factor'])->toBe([
            'enabled' => true,
            'required' => true,
        ]);
});
