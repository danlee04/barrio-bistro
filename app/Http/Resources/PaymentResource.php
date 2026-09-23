<?php

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * What a guest may know about an attempt: where to pay, how much, and how it
 * ended. Provider ids stay on the server.
 *
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'checkout_url' => $this->checkout_url,
            'amount' => $this->amount,
            'state' => $this->state->value,
            'method' => $this->method,
            'paid_at' => $this->paid_at?->toIso8601String(),
        ];
    }
}
