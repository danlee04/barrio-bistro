<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ResetStaffPasswordRequest;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class StaffPasswordController extends Controller
{
    /**
     * Give a staff member a new temporary password and sign them out everywhere.
     */
    public function __invoke(ResetStaffPasswordRequest $request, User $user): Response
    {
        $user->forceFill([
            'password' => $request->validated('password'),
            'must_change_password' => true,
            'remember_token' => Str::random(60),
        ])->save();

        AuditLog::record('staff.password_reset', $user);

        return response()->noContent();
    }
}
