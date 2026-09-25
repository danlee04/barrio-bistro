<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * Check the credentials and hand back who they belong to, without signing
     * anybody in. Nobody is authenticated here on purpose: an account with a
     * second factor has to clear that first, and logging them in now and
     * asking afterwards would mean they were already inside.
     *
     * @throws ValidationException
     */
    public function findAuthenticatedUser(): User
    {
        $this->ensureIsNotRateLimited();

        $provider = Auth::createUserProvider((string) config('auth.guards.web.provider'));
        $credentials = $this->only('email', 'password');
        $user = $provider->retrieveByCredentials($credentials);

        if (! $user instanceof User
            || ! $provider->validateCredentials($user, $credentials)
            || ! $user->is_active) {
            RateLimiter::hit($this->throttleKey());

            // Fired by hand because the guard is not doing the attempt: the
            // audit trail should still show every failure.
            event(new Failed('web', $user, $credentials));

            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        RateLimiter::clear($this->throttleKey());

        return $user;
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->input('email')).'|'.$this->ip());
    }
}
