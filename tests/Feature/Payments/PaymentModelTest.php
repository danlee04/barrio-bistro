<?php

use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;

test('a payment belongs to an order and casts its provider and state', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    $payment = Payment::factory()->for($order)->create(['amount' => 36000]);

    expect($payment->provider)->toBe(PaymentProvider::PayMongo)
        ->and($payment->state)->toBe(PaymentState::Pending)
        ->and($payment->amount)->toBe(36000)
        ->and($payment->order->is($order))->toBeTrue()
        ->and($order->payments()->count())->toBe(1);
});

test('two attempts cannot share one provider reference', function () {
    $order = Order::factory()->create();
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_same']);

    expect(fn () => Payment::factory()->for($order)->create(['provider_reference' => 'cs_same']))
        ->toThrow(UniqueConstraintViolationException::class);
});

test('counter payments carry no reference and remember the cashier', function () {
    $cashier = User::factory()->cashier()->create();
    $order = Order::factory()->create();

    Payment::factory()->for($order)->counter()->create(['received_by' => $cashier->id]);
    Payment::factory()->for($order)->counter()->create(['received_by' => $cashier->id]);

    expect($order->payments()->whereNull('provider_reference')->count())->toBe(2)
        ->and($order->latestPayment()?->receiver?->is($cashier))->toBeTrue();
});
