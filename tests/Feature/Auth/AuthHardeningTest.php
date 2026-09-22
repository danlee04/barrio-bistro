<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

test('password reset requests do not reveal whether an account exists', function () {
    Notification::fake();
    $user = User::factory()->create();

    $known = $this->postJson('/forgot-password', ['email' => $user->email]);
    $unknown = $this->postJson('/forgot-password', ['email' => 'nobody@example.com']);

    $known->assertOk();
    $unknown->assertOk();
    expect($unknown->json())->toBe($known->json());
    Notification::assertSentTo($user, ResetPassword::class);
});

test('login is throttled per ip even when every attempt uses a different email', function () {
    foreach (range(1, 20) as $attempt) {
        $this->postJson('/login', [
            'email' => "guess{$attempt}@example.com",
            'password' => 'wrong-password',
        ])->assertUnprocessable();
    }

    $this->postJson('/login', [
        'email' => 'guess21@example.com',
        'password' => 'wrong-password',
    ])->assertTooManyRequests();
});

test('the api is rate limited per user', function () {
    $this->actingAs(User::factory()->create());

    foreach (range(1, 60) as $attempt) {
        $this->getJson('/api/v1/me')->assertOk();
    }

    $this->getJson('/api/v1/me')->assertTooManyRequests();
});

test('passwords shorter than 12 characters are rejected', function () {
    $passes = fn (string $password): bool => Validator::make(
        ['password' => $password],
        ['password' => Password::defaults()],
    )->passes();

    expect($passes('short-pass1'))->toBeFalse()
        ->and($passes('a-long-enough-passphrase'))->toBeTrue();
});

test('unexpected attributes throw instead of being silently discarded', function () {
    expect(fn () => new User(['name' => 'Juan', 'is_admin' => true]))
        ->toThrow(MassAssignmentException::class);
});
