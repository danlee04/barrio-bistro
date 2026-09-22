<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListStaffRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

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
}
