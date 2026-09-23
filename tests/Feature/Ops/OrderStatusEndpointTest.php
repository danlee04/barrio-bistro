<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;

function staffOrder(OrderStatus $status, PaymentStatus $payment = PaymentStatus::Paid): Order
{
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    $order->status = $status;
    $order->payment_status = $payment;
    $order->save();

    OrderItem::factory()->for($order)->create([
        'item_name' => 'Adobo',
        'size_name' => 'Large',
        'unit_price' => 36000,
        'quantity' => 1,
        'line_total' => 36000,
        'note' => 'Walang sibuyas',
    ]);

    return $order;
}

test('the kitchen starts and finishes cooking', function () {
    $order = staffOrder(OrderStatus::Confirmed);
    $kitchen = User::factory()->kitchen()->create();

    $this->actingAs($kitchen)
        ->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'preparing'])
        ->assertOk()
        ->assertJsonPath('data.status', 'preparing')
        ->assertJsonPath('data.items.0.note', 'Walang sibuyas');

    $this->actingAs($kitchen)
        ->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'ready'])
        ->assertOk()
        ->assertJsonPath('data.status', 'ready');
});

test('the kitchen cannot hand food over or cancel, and the counter cannot cook', function () {
    $ready = staffOrder(OrderStatus::Ready);
    $confirmed = staffOrder(OrderStatus::Confirmed);
    $unpaid = staffOrder(OrderStatus::Pending, PaymentStatus::Unpaid);

    $kitchen = User::factory()->kitchen()->create();
    $cashier = User::factory()->cashier()->create();

    $this->actingAs($kitchen)
        ->patchJson("/api/v1/orders/{$ready->token}/status", ['status' => 'completed'])
        ->assertForbidden();

    $this->actingAs($kitchen)
        ->patchJson("/api/v1/orders/{$unpaid->token}/status", ['status' => 'cancelled'])
        ->assertForbidden();

    $this->actingAs($cashier)
        ->patchJson("/api/v1/orders/{$confirmed->token}/status", ['status' => 'preparing'])
        ->assertForbidden();

    expect($ready->fresh()->status)->toBe(OrderStatus::Ready)
        ->and($confirmed->fresh()->status)->toBe(OrderStatus::Confirmed);
});

test('the counter hands the food over', function () {
    $order = staffOrder(OrderStatus::Ready);

    $this->actingAs(User::factory()->cashier()->create())
        ->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('data.status', 'completed');
});

test('the counter cancels an unpaid order with a reason, but never a paid one', function () {
    $cashier = User::factory()->cashier()->create();
    $unpaid = staffOrder(OrderStatus::Pending, PaymentStatus::Unpaid);
    $paid = staffOrder(OrderStatus::Pending);

    $this->actingAs($cashier)
        ->patchJson("/api/v1/orders/{$unpaid->token}/status", [
            'status' => 'cancelled',
            'reason' => 'Guest left',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    $this->actingAs($cashier)
        ->patchJson("/api/v1/orders/{$paid->token}/status", ['status' => 'cancelled'])
        ->assertStatus(422);
});

test('an order cannot skip a step and cannot be confirmed by hand', function () {
    $order = staffOrder(OrderStatus::Confirmed);
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'completed'])
        ->assertStatus(422);

    $this->actingAs($admin)
        ->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'confirmed'])
        ->assertJsonValidationErrors(['status']);

    expect($order->fresh()->status)->toBe(OrderStatus::Confirmed);
});

test('a guest cannot move anything', function () {
    $order = staffOrder(OrderStatus::Confirmed);

    $this->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'preparing'])
        ->assertUnauthorized();

    expect($order->fresh()->status)->toBe(OrderStatus::Confirmed);
});
