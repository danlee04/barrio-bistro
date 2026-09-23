<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentState;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config()->set('paymongo.secret_key', 'sk_test_secret');
});

function fakeSession(string $id, string $status, int $amount): void
{
    Http::fake([
        "api.paymongo.com/v1/checkout_sessions/{$id}" => Http::response([
            'data' => [
                'id' => $id,
                'attributes' => [
                    'payments' => [[
                        'id' => 'pay_123',
                        'attributes' => [
                            'status' => $status,
                            'amount' => $amount,
                            'source' => ['type' => 'gcash'],
                        ],
                    ]],
                ],
            ],
        ], 200),
    ]);
}

test('a paid session confirms the order and moves it to the kitchen', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    $payment = Payment::factory()->for($order)->create([
        'provider_reference' => 'cs_paid',
        'amount' => 36000,
    ]);

    fakeSession('cs_paid', 'paid', 36000);

    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid')
        ->assertJsonPath('data.status', 'confirmed');

    $payment->refresh();

    expect($payment->state)->toBe(PaymentState::Paid)
        ->and($payment->method)->toBe('gcash')
        ->and($payment->provider_payment_id)->toBe('pay_123')
        ->and($payment->paid_at)->not->toBeNull()
        ->and(AuditLog::query()->where('action', 'order.paid')->count())->toBe(1);
});

test('an unpaid session changes nothing', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_open', 'amount' => 36000]);

    fakeSession('cs_open', 'awaiting_payment_method', 36000);

    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'unpaid')
        ->assertJsonPath('data.status', 'pending');

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid);
});

test('a payment for the wrong amount is refused and written down', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_short', 'amount' => 36000]);

    fakeSession('cs_short', 'paid', 100);

    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")->assertOk();

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid)
        ->and(AuditLog::query()->where('action', 'payment.amount_mismatch')->count())->toBe(1);
});

test('confirming twice pays the order once', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_twice', 'amount' => 36000]);

    fakeSession('cs_twice', 'paid', 36000);

    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")->assertOk();
    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")->assertOk();

    expect($order->payments()->where('state', PaymentState::Paid)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'order.paid')->count())->toBe(1);
});

test('an order already being cooked is not dragged back to confirmed', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    $order->status = OrderStatus::Preparing;
    $order->save();

    Payment::factory()->for($order)->create(['provider_reference' => 'cs_cooking', 'amount' => 36000]);

    fakeSession('cs_cooking', 'paid', 36000);

    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")->assertOk();

    expect($order->fresh()->status)->toBe(OrderStatus::Preparing)
        ->and($order->fresh()->payment_status)->toBe(PaymentStatus::Paid);
});
