<?php

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Testing\TestResponse;
use PragmaRX\Google2FA\Google2FA;

const SECRET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function codeNow(): string
{
    return app(Google2FA::class)->getCurrentOtp(SECRET);
}

function signInWithPassword(User $user): TestResponse
{
    return test()->postJson('/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);
}

test('the password alone does not sign in an account with a second factor', function () {
    $admin = User::factory()->admin()->create();

    signInWithPassword($admin)
        ->assertOk()
        ->assertJson(['two_factor' => true]);

    $this->assertGuest();
});

test('the code finishes the sign-in', function () {
    $admin = User::factory()->admin()->create();

    signInWithPassword($admin)->assertOk();

    $this->postJson('/two-factor-challenge', ['code' => codeNow()])->assertNoContent();

    $this->assertAuthenticatedAs($admin);
});

test('a code that has been used once is dead', function () {
    $admin = User::factory()->admin()->create();
    $code = codeNow();

    signInWithPassword($admin)->assertOk();
    $this->postJson('/two-factor-challenge', ['code' => $code])->assertNoContent();

    $this->postJson('/logout')->assertNoContent();
    signInWithPassword($admin)->assertOk();

    // Same half-minute, same six digits — and refused, because it was spent.
    $this->postJson('/two-factor-challenge', ['code' => $code])
        ->assertJsonValidationErrors(['code']);

    $this->assertGuest();
});

test('a wrong code leaves the door shut and is written down', function () {
    $admin = User::factory()->admin()->create();

    signInWithPassword($admin)->assertOk();

    $this->postJson('/two-factor-challenge', ['code' => '000000'])
        ->assertJsonValidationErrors(['code']);

    $this->assertGuest();

    expect(AuditLog::query()->where('action', 'two_factor.failed')->count())->toBe(1);
});

test('a challenge with no sign-in behind it goes nowhere', function () {
    User::factory()->admin()->create();

    $this->postJson('/two-factor-challenge', ['code' => codeNow()])
        ->assertJsonValidationErrors(['code']);

    $this->assertGuest();
});

test('a recovery code works once and is then struck off', function () {
    $admin = User::factory()->admin()->create();

    signInWithPassword($admin)->assertOk();
    $this->postJson('/two-factor-challenge', ['recovery_code' => 'aaaaaaaaaa'])
        ->assertNoContent();

    $this->assertAuthenticatedAs($admin);
    expect($admin->fresh()->two_factor_recovery_codes)->toHaveCount(2)
        ->and(AuditLog::query()->where('action', 'two_factor.recovery_code_used')->count())->toBe(1);

    $this->postJson('/logout')->assertNoContent();
    signInWithPassword($admin)->assertOk();

    $this->postJson('/two-factor-challenge', ['recovery_code' => 'aaaaaaaaaa'])
        ->assertJsonValidationErrors(['code']);

    $this->assertGuest();
});

test('the six digits are taken however the app spaced them', function () {
    $admin = User::factory()->admin()->create();
    $code = codeNow();

    signInWithPassword($admin)->assertOk();

    $this->postJson('/two-factor-challenge', [
        'code' => substr($code, 0, 3).' '.substr($code, 3),
    ])->assertNoContent();

    $this->assertAuthenticatedAs($admin);
});

test('a deactivated account cannot finish a sign-in it started', function () {
    $admin = User::factory()->admin()->create();

    signInWithPassword($admin)->assertOk();

    $admin->forceFill(['is_active' => false])->save();

    $this->postJson('/two-factor-challenge', ['code' => codeNow()])
        ->assertJsonValidationErrors(['code']);

    $this->assertGuest();
});

test('guessing the code is throttled', function () {
    $admin = User::factory()->admin()->create();

    signInWithPassword($admin)->assertOk();

    foreach (range(1, 5) as $attempt) {
        $this->postJson('/two-factor-challenge', ['code' => '000000'])
            ->assertJsonValidationErrors(['code']);
    }

    $this->postJson('/two-factor-challenge', ['code' => '000000'])->assertStatus(429);
});
