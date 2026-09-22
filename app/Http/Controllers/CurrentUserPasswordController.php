<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateCurrentUserPasswordRequest;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Response;

class CurrentUserPasswordController extends Controller
{
    /**
     * Replace the signed-in user's password; other sessions are signed out by Sanctum.
     */
    public function __invoke(UpdateCurrentUserPasswordRequest $request, #[CurrentUser] User $user): Response
    {
        $user->forceFill([
            'password' => $request->validated('password'),
            'must_change_password' => false,
        ])->save();

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        AuditLog::record('auth.password_changed', $user, $user);

        return response()->noContent();
    }
}
