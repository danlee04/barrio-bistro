<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderTransitioner;
use Illuminate\Validation\ValidationException;

function move(Order $order, OrderStatus $to, ?User $staff = null, ?string $reason = null): Order
{
    return app(OrderTransitioner::class)->move(
        $order,
        $to,
        $staff ?? User::factory()->admin()->create(),
        $reason,
    );
}

function orderAt(OrderStatus $status, PaymentStatus $payment = PaymentStatus::Paid): Order
{
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    $order->status = $status;
    $order->payment_status = $payment;
    $order->save();

    return $order;
}

test('an order walks the line from confirmed to completed', function () {
    $order = orderAt(OrderStatus::Confirmed);

    move($order, OrderStatus::Preparing);
    expect($order->fresh()->status)->toBe(OrderStatus::Preparing);

    move($order, OrderStatus::Ready);
    expect($order->fresh()->status)->toBe(OrderStatus::Ready);

    move($order, OrderStatus::Completed);
    expect($order->fresh()->status)->toBe(OrderStatus::Completed);
});

test('an order cannot skip a step or walk backwards', function () {
    $confirmed = orderAt(OrderStatus::Confirmed);
    $completed = orderAt(OrderStatus::Completed);

    expect(fn () => move($confirmed, OrderStatus::Completed))->toThrow(ValidationException::class);
    expect(fn () => move($completed, OrderStatus::Preparing))->toThrow(ValidationException::class);
    expect($confirmed->fresh()->status)->toBe(OrderStatus::Confirmed);
});

test('paying is the only thing that confirms an order', function () {
    $order = orderAt(OrderStatus::Pending, PaymentStatus::Unpaid);

    expect(fn () => move($order, OrderStatus::Confirmed))->toThrow(ValidationException::class);
    expect($order->fresh()->status)->toBe(OrderStatus::Pending);
});

test('an unpaid order may be cancelled and a paid one may not', function () {
    $unpaid = orderAt(OrderStatus::Pending, PaymentStatus::Unpaid);
    $paid = orderAt(OrderStatus::Pending);

    move($unpaid, OrderStatus::Cancelled, reason: 'Guest left');

    expect($unpaid->fresh()->status)->toBe(OrderStatus::Cancelled)
        ->and(fn () => move($paid, OrderStatus::Cancelled))->toThrow(ValidationException::class);
});

test('every move is written down with who made it', function () {
    $kitchen = User::factory()->kitchen()->create();
    $order = orderAt(OrderStatus::Confirmed);

    move($order, OrderStatus::Preparing, $kitchen);

    $entry = AuditLog::query()->where('action', 'order.preparing')->sole();

    expect($entry->causer_id)->toBe($kitchen->id)
        ->and($entry->context['from'])->toBe('confirmed');
});
