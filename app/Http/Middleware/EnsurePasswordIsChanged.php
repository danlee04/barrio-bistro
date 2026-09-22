<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordIsChanged
{
    /**
     * Block staff who still use an admin-set temporary password.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->must_change_password) {
            return response()->json([
                'message' => 'You must change your temporary password before continuing.',
                'code' => 'password_change_required',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
