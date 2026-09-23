<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Date;

function listed(Order $order, OrderStatus $status, PaymentStatus $payment = PaymentStatus::Paid): Order
{
    $order->status = $status;
    $order->payment_status = $payment;
    $order->save();

    return $order;
}

test('the counter sees everything still open today, newest first', function () {
    $pending = listed(Order::factory()->create(), OrderStatus::Pending, PaymentStatus::Unpaid);
    $ready = listed(Order::factory()->create(), OrderStatus::Ready);
    listed(Order::factory()->create(), OrderStatus::Completed);

    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/staff/orders?view=queue')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.token', $ready->token)
        ->assertJsonPath('data.1.token', $pending->token);
});

test('the kitchen sees only paid orders, oldest first', function () {
    listed(Order::factory()->create(), OrderStatus::Pending, PaymentStatus::Unpaid);
    $confirmed = listed(Order::factory()->create(), OrderStatus::Confirmed);
    $ready = listed(Order::factory()->create(), OrderStatus::Ready);
    listed(Order::factory()->create(), OrderStatus::Completed);

    $this->actingAs(User::factory()->kitchen()->create())
        ->getJson('/api/v1/staff/orders?view=kitchen')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.token', $confirmed->token)
        ->assertJsonPath('data.1.token', $ready->token);
});

test('the done view holds what is finished and cancelled', function () {
    listed(Order::factory()->create(), OrderStatus::Completed);
    listed(Order::factory()->create(), OrderStatus::Cancelled, PaymentStatus::Unpaid);
    listed(Order::factory()->create(), OrderStatus::Ready);

    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/staff/orders?view=done')
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

test('yesterday stays in yesterday', function () {
    $old = Order::factory()->create([
        'business_date' => Date::now('Asia/Manila')->subDay()->toDateString(),
    ]);
    listed($old, OrderStatus::Ready);

    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/staff/orders?view=queue')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

test('guests cannot read the queue', function () {
    $this->getJson('/api/v1/staff/orders?view=queue')->assertUnauthorized();
});

test('staff are told which buttons they may press', function () {
    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.manage_orders', true)
        ->assertJsonPath('abilities.cook_orders', false);

    $this->actingAs(User::factory()->kitchen()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.manage_orders', false)
        ->assertJsonPath('abilities.cook_orders', true);
});
