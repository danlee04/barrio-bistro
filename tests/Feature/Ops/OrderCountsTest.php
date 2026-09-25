<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Date;

function countedOrder(OrderStatus $status, PaymentStatus $payment, ?string $date = null): Order
{
    $order = Order::factory()->create([
        'business_date' => $date ?? Date::now('Asia/Manila')->toDateString(),
    ]);

    $order->status = $status;
    $order->payment_status = $payment;
    $order->save();

    return $order;
}

function counts(User $staff): array
{
    return test()->actingAs($staff)
        ->getJson('/api/v1/staff/order-counts')
        ->assertOk()
        ->json('data');
}

test('the counts follow the three screens they belong to', function () {
    $cashier = User::factory()->cashier()->create();

    countedOrder(OrderStatus::Pending, PaymentStatus::Unpaid);
    countedOrder(OrderStatus::Confirmed, PaymentStatus::Paid);
    countedOrder(OrderStatus::Confirmed, PaymentStatus::Paid);
    countedOrder(OrderStatus::Preparing, PaymentStatus::Paid);
    countedOrder(OrderStatus::Ready, PaymentStatus::Paid);

    expect(counts($cashier))->toBe([
        'queue' => 5,
        'kitchen' => 4,
        'kitchen_new' => 2,
    ]);
});

test('finished and cancelled orders stop counting', function () {
    $cashier = User::factory()->cashier()->create();

    countedOrder(OrderStatus::Completed, PaymentStatus::Paid);
    countedOrder(OrderStatus::Cancelled, PaymentStatus::Unpaid);

    expect(counts($cashier))->toBe([
        'queue' => 0,
        'kitchen' => 0,
        'kitchen_new' => 0,
    ]);
});

test('yesterday is not the counter’s problem', function () {
    $cashier = User::factory()->cashier()->create();

    countedOrder(
        OrderStatus::Confirmed,
        PaymentStatus::Paid,
        Date::now('Asia/Manila')->subDay()->toDateString(),
    );

    expect(counts($cashier))->toBe([
        'queue' => 0,
        'kitchen' => 0,
        'kitchen_new' => 0,
    ]);
});

test('an unpaid order waits at the counter, not in the kitchen', function () {
    $cashier = User::factory()->cashier()->create();

    countedOrder(OrderStatus::Pending, PaymentStatus::Unpaid);

    expect(counts($cashier))->toBe([
        'queue' => 1,
        'kitchen' => 0,
        'kitchen_new' => 0,
    ]);
});

test('a stranger is not told how busy the shop is', function () {
    $this->getJson('/api/v1/staff/order-counts')->assertUnauthorized();
});
