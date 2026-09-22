<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\MenuItem;
use App\Models\User;

class MenuItemPolicy
{
    /**
     * Determine whether the user can list items in the admin.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can open an item for editing.
     */
    public function view(User $user, MenuItem $menuItem): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can add items.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can change an item's details, prices or photo.
     */
    public function update(User $user, MenuItem $menuItem): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can archive an item.
     */
    public function delete(User $user, MenuItem $menuItem): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore an archived item.
     */
    public function restore(User $user, MenuItem $menuItem): bool
    {
        return $user->isAdmin();
    }

    /**
     * Any staff role may mark items sold out ("Ubos na") or available again.
     */
    public function updateAvailability(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Cashier, Role::Kitchen);
    }
}
