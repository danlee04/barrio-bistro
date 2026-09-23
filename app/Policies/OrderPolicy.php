<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\User;

class OrderPolicy
{
    /**
     * Cashiers take money at the counter; an admin may stand in for them.
     * Whether the order itself can still be paid — already settled, cancelled —
     * is the confirmer's call, because an admin passes this gate through
     * `Gate::before` regardless.
     */
    public function markPaid(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Cashier);
    }
}
