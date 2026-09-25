<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * An admin holds every customer's details and the till. A password on its own
 * is not enough to stand in front of that, so the admin area stays shut until
 * the second factor is on.
 *
 * Only the admin area: the counter tablet is shared between whoever is on
 * shift, and asking each of them for a phone at every sign-in would end with
 * one login left open all day, which is worse than where we started.
 */
class EnsureTwoFactorIsEnabled
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->isAdmin() && ! $user->hasTwoFactorEnabled()) {
            return response()->json([
                'message' => 'Turn on two-step sign-in before opening the admin.',
                'code' => 'two_factor_required',
            ], 403);
        }

        return $next($request);
    }
}
