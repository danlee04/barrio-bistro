<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\User;

test('a cashier records the money handed over at the counter', function () {
    $cashier = User::factory()->cashier()->create();
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);

    $this->actingAs($cashier)
        ->postJson("/api/v1/orders/{$order->token}/mark-paid")
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid')
        ->assertJsonPath('data.status', 'confirmed')
        ->assertJsonPath('data.payment_method', 'counter');

    $payment = $order->payments()->sole();

    expect($payment->provider)->toBe(PaymentProvider::Counter)
        ->and($payment->amount)->toBe(36000)
        ->and($payment->received_by)->toBe($cashier->id)
        ->and(AuditLog::query()->where('action', 'order.paid')->where('causer_id', $cashier->id)->count())->toBe(1);
});

test('the kitchen cannot take money and a guest cannot either', function () {
    $order = Order::factory()->create();

    $this->postJson("/api/v1/orders/{$order->token}/mark-paid")->assertUnauthorized();

    $this->actingAs(User::factory()->kitchen()->create())
        ->postJson("/api/v1/orders/{$order->token}/mark-paid")
        ->assertForbidden();

    expect($order->payments()->count())->toBe(0)
        ->and($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid);
});

test('an admin may take payment too', function () {
    $order = Order::factory()->create(['subtotal' => 10000, 'total' => 10000]);

    $this->actingAs(User::factory()->admin()->create())
        ->postJson("/api/v1/orders/{$order->token}/mark-paid")
        ->assertOk();

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Paid);
});

test('an order cannot be paid twice, and a cancelled one not at all', function () {
    $cashier = User::factory()->cashier()->create();

    $paid = Order::factory()->create(['subtotal' => 10000, 'total' => 10000]);
    $this->actingAs($cashier)->postJson("/api/v1/orders/{$paid->token}/mark-paid")->assertOk();
    $this->actingAs($cashier)->postJson("/api/v1/orders/{$paid->token}/mark-paid")->assertStatus(422);

    $cancelled = Order::factory()->create();
    $cancelled->status = OrderStatus::Cancelled;
    $cancelled->save();

    $this->actingAs($cashier)->postJson("/api/v1/orders/{$cancelled->token}/mark-paid")->assertStatus(422);

    expect($paid->payments()->count())->toBe(1)
        ->and($cancelled->payments()->count())->toBe(0);
});

test('the signed-in cashier is told they may take payments', function () {
    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('abilities.mark_paid', true);

    $this->actingAs(User::factory()->kitchen()->create())
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('abilities.mark_paid', false);
});
