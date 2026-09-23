<?php

use App\Models\Order;
use App\Models\OrderItem;
use App\Services\PayMongoClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config()->set('paymongo.secret_key', 'sk_test_secret');
    config()->set('paymongo.methods', ['gcash', 'card']);
});

function orderWithLines(): Order
{
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    OrderItem::factory()->for($order)->create([
        'item_name' => 'Adobo',
        'size_name' => 'Large',
        'unit_price' => 18000,
        'quantity' => 2,
        'line_total' => 36000,
    ]);

    return $order->load('items');
}

test('a checkout session is created with the order priced in centavos', function () {
    Http::fake([
        'api.paymongo.com/v1/checkout_sessions' => Http::response([
            'data' => [
                'id' => 'cs_abc123',
                'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/cs_abc123'],
            ],
        ], 200),
    ]);

    $order = orderWithLines();

    $session = app(PayMongoClient::class)->createCheckoutSession(
        $order,
        'https://bistro.test/order/'.$order->token.'?paid=1',
        'https://bistro.test/order/'.$order->token,
    );

    expect($session)->toBe([
        'id' => 'cs_abc123',
        'checkout_url' => 'https://checkout.paymongo.com/cs_abc123',
    ]);

    Http::assertSent(function (Request $request) use ($order): bool {
        $attributes = $request->data()['data']['attributes'];

        return $request->hasHeader('Authorization', 'Basic '.base64_encode('sk_test_secret:'))
            && $attributes['payment_method_types'] === ['gcash', 'card']
            && $attributes['line_items'][0]['amount'] === 18000
            && $attributes['line_items'][0]['quantity'] === 2
            && $attributes['line_items'][0]['currency'] === 'PHP'
            && $attributes['reference_number'] === $order->order_number
            && $attributes['metadata']['order_token'] === $order->token;
    });
});

test('a refusal from paymongo is reported as nothing, not an exception', function () {
    Http::fake([
        'api.paymongo.com/*' => Http::response(['errors' => [['detail' => 'Amount too small']]], 400),
    ]);

    expect(app(PayMongoClient::class)->createCheckoutSession(orderWithLines(), 'https://a', 'https://b'))
        ->toBeNull();
});

test('a session is read back by id', function () {
    Http::fake([
        'api.paymongo.com/v1/checkout_sessions/cs_abc123' => Http::response([
            'data' => [
                'id' => 'cs_abc123',
                'attributes' => [
                    'payments' => [[
                        'id' => 'pay_1',
                        'attributes' => ['status' => 'paid', 'amount' => 36000, 'source' => ['type' => 'gcash']],
                    ]],
                ],
            ],
        ], 200),
    ]);

    $attributes = app(PayMongoClient::class)->checkoutSession('cs_abc123');

    expect($attributes['payments'][0]['attributes']['status'])->toBe('paid');
});

test('without a key the client is switched off', function () {
    config()->set('paymongo.secret_key', '');
    Http::fake();

    $client = app(PayMongoClient::class);

    expect($client->enabled())->toBeFalse()
        ->and($client->createCheckoutSession(orderWithLines(), 'https://a', 'https://b'))->toBeNull();

    Http::assertNothingSent();
});
