<?php

use App\Enums\PaymentState;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    config()->set('paymongo.secret_key', 'sk_test_secret');
    config()->set('paymongo.webhook_secret', 'whsk_test_secret');
});

function webhookPayload(string $reference, string $type = 'checkout_session.payment.paid'): array
{
    return [
        'data' => [
            'id' => 'evt_1',
            'attributes' => [
                'type' => $type,
                'livemode' => false,
                'data' => [
                    'id' => $reference,
                    'attributes' => ['metadata' => ['order_token' => 'unused']],
                ],
            ],
        ],
    ];
}

/**
 * Post a webhook the way PayMongo does: a raw JSON body with a signature over
 * "timestamp.body".
 */
function postWebhook(array $payload, ?int $timestamp = null, string $secret = 'whsk_test_secret'): TestResponse
{
    $body = json_encode($payload, JSON_THROW_ON_ERROR);
    $timestamp ??= time();
    $signature = hash_hmac('sha256', $timestamp.'.'.$body, $secret);

    return test()->call(
        'POST',
        '/api/v1/webhooks/paymongo',
        [],
        [],
        [],
        [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_PAYMONGO_SIGNATURE' => "t={$timestamp},te={$signature},li=",
        ],
        $body,
    );
}

function paidSession(string $id, int $amount = 36000): void
{
    Http::fake([
        "api.paymongo.com/v1/checkout_sessions/{$id}" => Http::response([
            'data' => [
                'id' => $id,
                'attributes' => [
                    'payments' => [[
                        'id' => 'pay_hook',
                        'attributes' => ['status' => 'paid', 'amount' => $amount, 'source' => ['type' => 'card']],
                    ]],
                ],
            ],
        ], 200),
    ]);
}

test('a signed event pays the order', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_hook', 'amount' => 36000]);
    paidSession('cs_hook');

    postWebhook(webhookPayload('cs_hook'))->assertOk()->assertJsonPath('received', true);

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Paid)
        ->and($order->fresh()->status->value)->toBe('confirmed')
        ->and($order->payments()->sole()->method)->toBe('card');
});

test('an unsigned or wrongly signed event changes nothing', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_hook', 'amount' => 36000]);
    paidSession('cs_hook');

    postWebhook(webhookPayload('cs_hook'), secret: 'whsk_wrong')->assertStatus(400);

    $this->postJson('/api/v1/webhooks/paymongo', webhookPayload('cs_hook'))->assertStatus(400);

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid);
});

test('an old signature is treated as a replay', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_hook', 'amount' => 36000]);
    paidSession('cs_hook');

    postWebhook(webhookPayload('cs_hook'), timestamp: time() - 3600)->assertStatus(400);

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid);
});

test('the same event twice pays once', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_hook', 'amount' => 36000]);
    paidSession('cs_hook');

    postWebhook(webhookPayload('cs_hook'))->assertOk();
    postWebhook(webhookPayload('cs_hook'))->assertOk();

    expect($order->payments()->where('state', PaymentState::Paid)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'order.paid')->count())->toBe(1);
});

test('an event about a payment we never started is accepted and ignored', function () {
    Http::fake();

    postWebhook(webhookPayload('cs_someone_else'))->assertOk();

    expect(Payment::query()->count())->toBe(0);

    Http::assertNothingSent();
});

test('a payment.paid event finds the order through its metadata', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_meta', 'amount' => 36000]);
    paidSession('cs_meta');

    $payload = [
        'data' => [
            'id' => 'evt_2',
            'attributes' => [
                'type' => 'payment.paid',
                'data' => [
                    'id' => 'pay_meta',
                    'attributes' => ['metadata' => ['order_token' => $order->token]],
                ],
            ],
        ],
    ];

    postWebhook($payload)->assertOk();

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Paid);
});
