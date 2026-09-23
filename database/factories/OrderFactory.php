<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Date;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $today = Date::now((string) config('restaurant.timezone'));
        $dailyNumber = fake()->unique()->numberBetween(1, 9999);

        return [
            'order_number' => sprintf(
                '%s-%s-%04d',
                (string) config('restaurant.order_prefix'),
                $today->format('Ymd'),
                $dailyNumber,
            ),
            'business_date' => $today->toDateString(),
            'daily_number' => $dailyNumber,
            'type' => OrderType::DineIn,
            'table_number' => fake()->numberBetween(1, 20),
            'customer_name' => null,
            'status' => OrderStatus::Pending,
            'payment_status' => PaymentStatus::Unpaid,
            'payment_method' => PaymentMethod::Counter,
            'subtotal' => 0,
            'total' => 0,
        ];
    }

    /**
     * An order somebody is waiting to carry out.
     */
    public function takeout(): static
    {
        return $this->state(fn (): array => [
            'type' => OrderType::Takeout,
            'table_number' => null,
            'customer_name' => fake()->firstName(),
        ]);
    }
}
