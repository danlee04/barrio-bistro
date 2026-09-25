<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\TwoFactorChallengeRequest;
use App\Http\Requests\ConfirmPasswordRequest;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\TwoFactorAuthenticator;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class TwoFactorController extends Controller
{
    public function __construct(private readonly TwoFactorAuthenticator $twoFactor) {}

    /**
     * Where this account stands: on, half set up, or off.
     */
    public function show(#[CurrentUser] User $user): JsonResponse
    {
        return response()->json(['data' => [
            'enabled' => $user->hasTwoFactorEnabled(),
            'pending' => $user->two_factor_secret !== null && ! $user->hasTwoFactorEnabled(),
            'required' => $user->isAdmin(),
            'recovery_codes_left' => count($user->two_factor_recovery_codes ?? []),
        ]]);
    }

    /**
     * Start setting it up: a new secret, and the QR that carries it.
     *
     * Nothing is switched on here. Until a code comes back the account still
     * signs in on its password alone, so a setup left halfway cannot shut
     * anybody out of their own shop.
     */
    public function store(#[CurrentUser] User $user): JsonResponse
    {
        $secret = $this->twoFactor->newSecret();

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_last_step' => null,
        ])->save();

        return response()->json(['data' => [
            'secret' => $secret,
            'uri' => $this->twoFactor->setupUri($user, $secret),
            'qr' => $this->twoFactor->qrCode($user, $secret),
        ]]);
    }

    /**
     * Prove the phone and the server agree, then switch it on and hand over
     * the recovery codes — the only time they are ever shown.
     *
     * @throws ValidationException
     */
    public function confirm(TwoFactorChallengeRequest $request, #[CurrentUser] User $user): JsonResponse
    {
        $secret = $user->two_factor_secret;
        $code = (string) $request->validated('code');

        if ($secret === null || $code === '' || ! $this->twoFactor->isValidFor($secret, $code)) {
            throw ValidationException::withMessages([
                'code' => 'That code did not match. Check your phone’s clock and try the next one.',
            ]);
        }

        $codes = $this->twoFactor->newRecoveryCodes();

        $user->forceFill([
            'two_factor_recovery_codes' => $this->twoFactor->hashRecoveryCodes($codes),
            'two_factor_confirmed_at' => now(),
        ])->save();

        AuditLog::record('two_factor.enabled', $user, $user);

        return response()->json(['data' => ['recovery_codes' => $codes]]);
    }

    /**
     * Replace the recovery codes, showing the new ones once.
     */
    public function recoveryCodes(ConfirmPasswordRequest $request, #[CurrentUser] User $user): JsonResponse
    {
        if (! $user->hasTwoFactorEnabled()) {
            throw ValidationException::withMessages([
                'password' => 'Two-step sign-in is not on for this account.',
            ]);
        }

        $codes = $this->twoFactor->newRecoveryCodes();

        $user->forceFill([
            'two_factor_recovery_codes' => $this->twoFactor->hashRecoveryCodes($codes),
        ])->save();

        AuditLog::record('two_factor.recovery_codes_replaced', $user, $user);

        return response()->json(['data' => ['recovery_codes' => $codes]]);
    }

    /**
     * Switch it off. The password is asked for again, because this is the
     * first thing somebody on a borrowed screen would reach for.
     */
    public function destroy(ConfirmPasswordRequest $request, #[CurrentUser] User $user): Response
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_last_step' => null,
        ])->save();

        AuditLog::record('two_factor.disabled', $user, $user);

        return response()->noContent();
    }
}
