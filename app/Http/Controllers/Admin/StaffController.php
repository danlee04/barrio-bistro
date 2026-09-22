<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListStaffRequest;
use App\Http\Requests\Admin\StoreStaffRequest;
use App\Http\Requests\Admin\UpdateStaffRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class StaffController extends Controller
{
    /**
     * List staff accounts, optionally searched by name/email and filtered by role.
     */
    public function index(ListStaffRequest $request): AnonymousResourceCollection
    {
        $search = $request->string('search')->trim()->toString();
        $role = $request->string('role')->toString();

        $query = User::query()->orderBy('name');

        if ($search !== '') {
            $query->whereAny(['name', 'email'], 'like', "%{$search}%");
        }

        if ($role !== '') {
            $query->where('role', $role);
        }

        return UserResource::collection(
            $query->paginate($request->integer('per_page', 20))->withQueryString(),
        );
    }

    /**
     * Add a staff member with an admin-set temporary password they must change at first login.
     */
    public function store(StoreStaffRequest $request): JsonResponse
    {
        $staff = DB::transaction(function () use ($request): User {
            $staff = new User($request->safe()->only(['name', 'email', 'password']));
            $staff->forceFill([
                'role' => $request->enum('role', Role::class),
                'is_active' => true,
                'must_change_password' => true,
            ])->save();

            AuditLog::record('staff.created', $staff, context: ['role' => $staff->role->value]);

            return $staff;
        });

        return UserResource::make($staff)->response()->setStatusCode(201);
    }

    /**
     * Change a staff member's details, role or active status.
     */
    public function update(UpdateStaffRequest $request, User $user): UserResource
    {
        DB::transaction(function () use ($request, $user): void {
            $user->fill($request->safe()->only(['name', 'email']));

            $role = $request->enum('role', Role::class);

            if ($role !== null) {
                $user->role = $role;
            }

            if ($request->has('is_active')) {
                $user->is_active = $request->boolean('is_active');
            }

            $user->save();

            if ($user->wasChanged()) {
                AuditLog::recordChange('staff.updated', $user);
            }
        });

        return UserResource::make($user);
    }
}
