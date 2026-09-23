<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config()->set('paymongo.secret_key', 'sk_test_secret');
});

/**
 * Hand out one checkout session per call, the way PayMongo does: every attempt
 * gets its own id.
 */
function fakeCheckout(string ...$ids): void
{
    $sequence = Http::sequence();

    foreach ($ids as $id) {
        $sequence->push([
            'data' => [
                'id' => $id,
                'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/'.$id],
            ],
        ], 200);
    }

    Http::fake(['api.paymongo.com/v1/checkout_sessions' => $sequence]);
}

function payableOrder(int $total = 36000): Order
{
    $order = Order::factory()->create(['subtotal' => $total, 'total' => $total]);
    OrderItem::factory()->for($order)->create([
        'item_name' => 'Adobo',
        'size_name' => 'Large',
        'unit_price' => $total,
        'quantity' => 1,
        'line_total' => $total,
    ]);

    return $order;
}

test('a guest starts an online payment and gets a checkout url', function () {
    fakeCheckout('cs_abc123');

    $order = payableOrder();

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")
        ->assertCreated()
        ->assertJsonPath('data.checkout_url', 'https://checkout.paymongo.com/cs_abc123')
        ->assertJsonPath('data.state', 'pending');

    $payment = $order->payments()->sole();

    expect($payment->provider)->toBe(PaymentProvider::PayMongo)
        ->and($payment->provider_reference)->toBe('cs_abc123')
        ->and($payment->amount)->toBe(36000)
        ->and($payment->state)->toBe(PaymentState::Pending)
        ->and($order->fresh()->payment_method->value)->toBe('online')
        ->and($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid);
});

test('a second attempt is its own row, so the history stays readable', function () {
    fakeCheckout('cs_first', 'cs_second');

    $order = payableOrder();

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")->assertCreated();
    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")
        ->assertCreated()
        ->assertJsonPath('data.checkout_url', 'https://checkout.paymongo.com/cs_second');

    expect($order->payments()->count())->toBe(2);
});

test('an order that is already paid or cancelled cannot be paid again', function () {
    fakeCheckout('cs_unused');

    $paid = payableOrder();
    $paid->payment_status = PaymentStatus::Paid;
    $paid->save();

    $cancelled = payableOrder();
    $cancelled->status = OrderStatus::Cancelled;
    $cancelled->save();

    $this->postJson("/api/v1/orders/{$paid->token}/checkout-session")->assertStatus(422);
    $this->postJson("/api/v1/orders/{$cancelled->token}/checkout-session")->assertStatus(422);

    expect($paid->payments()->count())->toBe(0);
});

test('a small order is sent to the counter instead', function () {
    fakeCheckout('cs_unused');
    config()->set('paymongo.minimum_amount', 10000);

    $order = payableOrder(5000);

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")
        ->assertStatus(422)
        ->assertJsonPath('code', 'below_online_minimum');
});

test('with no key at all the guest is told to pay at the counter', function () {
    config()->set('paymongo.secret_key', '');

    $order = payableOrder();

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")
        ->assertStatus(503)
        ->assertJsonPath('code', 'online_payment_unavailable');
});

test('starting payments is rate limited', function () {
    fakeCheckout(...array_map(fn (int $attempt): string => 'cs_'.$attempt, range(1, 10)));

    $order = payableOrder();

    foreach (range(1, 10) as $attempt) {
        $this->postJson("/api/v1/orders/{$order->token}/checkout-session")->assertCreated();
    }

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")->assertTooManyRequests();
});
