<?php

namespace Database\Factories;

use App\Enums\Role;
use App\Models\User;
use App\Services\TwoFactorAuthenticator;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'role' => Role::Kitchen,
            'is_active' => true,
            'must_change_password' => false,
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Indicate that the user is an admin.
     */
    /**
     * An admin, and therefore one with the second factor already on: the admin
     * area refuses an account without it, so an admin lacking one is a
     * half-made account, not a usable one. Ask for `withoutTwoFactor()` when
     * that half-made state is the thing under test.
     */
    public function admin(): static
    {
        return $this
            ->state(fn (array $attributes): array => ['role' => Role::Admin])
            ->withTwoFactor();
    }

    /**
     * Strip the second factor back off, for the tests that are about not
     * having one yet.
     */
    public function withoutTwoFactor(): static
    {
        return $this->state(fn (array $attributes): array => [
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_last_step' => null,
        ]);
    }

    /**
     * An account with the second factor already switched on and confirmed.
     * The secret is fixed so a test can work out the code of the moment.
     */
    public function withTwoFactor(string $secret = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'): static
    {
        return $this->state(fn (array $attributes): array => [
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => app(TwoFactorAuthenticator::class)
                ->hashRecoveryCodes(['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc']),
            'two_factor_confirmed_at' => now(),
        ]);
    }

    /**
     * Indicate that the user is a cashier.
     */
    public function cashier(): static
    {
        return $this->state(fn (array $attributes) => ['role' => Role::Cashier]);
    }

    /**
     * Indicate that the user works in the kitchen.
     */
    public function kitchen(): static
    {
        return $this->state(fn (array $attributes) => ['role' => Role::Kitchen]);
    }

    /**
     * Indicate that the account has been deactivated.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => ['is_active' => false]);
    }

    /**
     * Indicate that the user still has an admin-set temporary password.
     */
    public function mustChangePassword(): static
    {
        return $this->state(fn (array $attributes) => ['must_change_password' => true]);
    }
}
