<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Applies one step of an order's life. The policy says who may ask; this says
 * whether the order itself can go there, which is why an admin cannot shortcut
 * it either.
 */
class OrderTransitioner
{
    /**
     * @throws ValidationException
     */
    public function move(Order $order, OrderStatus $to, User $staff, ?string $reason = null): Order
    {
        if ($to === OrderStatus::Confirmed) {
            throw ValidationException::withMessages([
                'status' => 'An order is confirmed by being paid, not by hand.',
            ]);
        }

        if (! in_array($to, $order->status->allowedNext(), true)) {
            throw ValidationException::withMessages([
                'status' => "This order is {$order->status->label()} and cannot move to {$to->label()}.",
            ]);
        }

        if ($to === OrderStatus::Cancelled && $order->payment_status === PaymentStatus::Paid) {
            throw ValidationException::withMessages([
                'status' => 'A paid order cannot be cancelled here. Refund it with the provider first.',
            ]);
        }

        $from = $order->status;

        DB::transaction(function () use ($order, $to, $from, $staff, $reason): void {
            $order->status = $to;
            $order->save();

            $context = ['from' => $from->value];

            if ($reason !== null && trim($reason) !== '') {
                $context['reason'] = trim($reason);
            }

            AuditLog::record('order.'.$to->value, $order, $staff, $context);
        });

        return $order;
    }
}
