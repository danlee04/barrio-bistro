<?php

namespace App\Http\Resources;

use App\Enums\PaymentState;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An order as the counter and the kitchen need to read it: what the guest sees,
 * plus when it was paid.
 *
 * @mixin Order
 */
class StaffOrderResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'token' => $this->token,
            'order_number' => $this->order_number,
            'daily_number' => $this->daily_number,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'table_number' => $this->table_number,
            'customer_name' => $this->customer_name,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'payment_status' => $this->payment_status->value,
            'payment_method' => $this->payment_method->value,
            'payment_method_label' => $this->payment_method->label(),
            'total' => $this->total,
            'placed_at' => $this->created_at?->toIso8601String(),
            'paid_at' => $this->whenLoaded('payments', fn (): ?string => $this->payments
                ->first(fn (Payment $payment): bool => $payment->state === PaymentState::Paid)
                ?->paid_at?->toIso8601String()),
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
