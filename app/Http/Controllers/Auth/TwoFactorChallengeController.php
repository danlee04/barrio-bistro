<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\TwoFactorChallengeRequest;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\TwoFactorAuthenticator;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class TwoFactorChallengeController extends Controller
{
    public function __construct(private readonly TwoFactorAuthenticator $twoFactor) {}

    /**
     * The second half of signing in.
     *
     * The password step left only an id in the session — nobody is signed in
     * until a code or a recovery code lands here.
     *
     * @throws ValidationException
     */
    public function __invoke(TwoFactorChallengeRequest $request): Response
    {
        $user = $this->waiting($request->session()->get('two_factor.id'));

        if ($user === null) {
            throw ValidationException::withMessages([
                'code' => 'That sign-in has expired. Start again.',
            ]);
        }

        $recovery = $request->validated('recovery_code');
        $code = $request->validated('code');

        $passed = is_string($recovery) && $recovery !== ''
            ? $this->twoFactor->useRecoveryCode($user, $recovery)
            : is_string($code) && $this->twoFactor->verify($user, $code);

        if (! $passed) {
            AuditLog::record('two_factor.failed', $user, context: ['id' => $user->id]);

            throw ValidationException::withMessages([
                'code' => 'That code did not work. Try the next one your app shows.',
            ]);
        }

        if (is_string($recovery) && $recovery !== '') {
            AuditLog::record('two_factor.recovery_code_used', $user, $user);
        }

        $remember = (bool) $request->session()->get('two_factor.remember', false);

        Auth::guard('web')->login($user, $remember);

        $request->session()->regenerate();
        $request->session()->forget('two_factor');

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->noContent();
    }

    /**
     * Whoever the password step left at the door, if they are still allowed in.
     */
    private function waiting(mixed $id): ?User
    {
        if (! is_int($id) && ! is_string($id)) {
            return null;
        }

        $user = User::query()->find($id);

        return $user instanceof User && $user->is_active && $user->hasTwoFactorEnabled()
            ? $user
            : null;
    }
}
