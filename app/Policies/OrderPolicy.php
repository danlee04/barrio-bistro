<?php

namespace App\Policies;

use App\Enums\OrderStatus;
use App\Enums\Role;
use App\Models\Order;
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

    /**
     * Every staff role may watch the queue; the buttons are what differ.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Cashier, Role::Kitchen);
    }

    /**
     * Counter work: taking payment, handing the food over, cancelling.
     */
    public function manageOrders(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Cashier);
    }

    /**
     * Kitchen work: starting a dish and calling it ready.
     */
    public function cookOrders(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Kitchen);
    }

    /**
     * Who may ask for this particular move. Whether the order can actually go
     * there is the transitioner's call.
     */
    public function transition(User $user, Order $order, OrderStatus $to): bool
    {
        return match ($to) {
            OrderStatus::Preparing, OrderStatus::Ready => $this->cookOrders($user),
            OrderStatus::Completed, OrderStatus::Cancelled => $this->manageOrders($user),
            default => false,
        };
    }
}
