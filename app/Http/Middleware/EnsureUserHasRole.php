<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Allow the request only when the signed-in user has one of the given roles.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        $allowedRoles = array_map(fn (string $role): Role => Role::from($role), $roles);

        if (! $user instanceof User || ! $user->hasRole(...$allowedRoles)) {
            abort(Response::HTTP_FORBIDDEN, 'You do not have access to this area.');
        }

        return $next($request);
    }
}
