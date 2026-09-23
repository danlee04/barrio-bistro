<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;

class CurrentUserController extends Controller
{
    /**
     * Show the signed-in staff member and which admin areas the UI may offer them.
     */
    public function __invoke(#[CurrentUser] User $user): UserResource
    {
        return UserResource::make($user)->additional([
            'abilities' => [
                'manage_staff' => $user->can('viewAny', User::class),
                'manage_menu' => $user->can('create', MenuItem::class),
                'update_availability' => $user->can('updateAvailability', MenuItem::class),
                'mark_paid' => $user->can('markPaid', Order::class),
            ],
        ]);
    }
}
