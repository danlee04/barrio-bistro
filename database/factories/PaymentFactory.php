<?php

namespace Database\Factories;

use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'provider' => PaymentProvider::PayMongo,
            'provider_reference' => 'cs_'.Str::lower(Str::random(24)),
            'method' => null,
            'amount' => 36000,
            'state' => PaymentState::Pending,
            'checkout_url' => 'https://checkout.paymongo.com/'.Str::lower(Str::random(20)),
            'paid_at' => null,
            'received_by' => null,
        ];
    }

    /**
     * Money handed over at the counter: no provider, no reference.
     */
    public function counter(): static
    {
        return $this->state(fn (): array => [
            'provider' => PaymentProvider::Counter,
            'provider_reference' => null,
            'method' => 'counter',
            'state' => PaymentState::Paid,
            'checkout_url' => null,
            'paid_at' => now(),
        ]);
    }

    /**
     * An online attempt that went through.
     */
    public function paid(): static
    {
        return $this->state(fn (): array => [
            'state' => PaymentState::Paid,
            'method' => 'gcash',
            'provider_payment_id' => 'pay_'.Str::lower(Str::random(24)),
            'paid_at' => now(),
        ]);
    }
}
