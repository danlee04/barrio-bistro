<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

class AuthenticatedSessionController extends Controller
{
    /**
     * Handle an incoming authentication request.
     *
     * A right password is not a sign-in on its own. When the account carries a
     * second factor, nothing is authenticated here: the session only remembers
     * who is waiting at the door, and the code opens it.
     */
    public function store(LoginRequest $request): JsonResponse|Response
    {
        $user = $request->findAuthenticatedUser();

        if ($user->hasTwoFactorEnabled()) {
            $request->session()->put('two_factor.id', $user->id);
            $request->session()->put('two_factor.remember', $request->boolean('remember'));

            return response()->json(['two_factor' => true]);
        }

        $this->signIn($request, $user, $request->boolean('remember'));

        return response()->noContent();
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): Response
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return response()->noContent();
    }

    /**
     * Start the session properly: a new id, so a session handed over before
     * signing in cannot be reused afterwards.
     */
    protected function signIn(Request $request, User $user, bool $remember): void
    {
        Auth::guard('web')->login($user, $remember);

        $request->session()->regenerate();
        $request->session()->forget('two_factor');

        $user->forceFill(['last_login_at' => now()])->save();
    }
}
