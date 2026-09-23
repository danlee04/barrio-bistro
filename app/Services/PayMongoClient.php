<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The only place in the app that talks to PayMongo. Everything it returns is
 * treated as a claim to be checked, never as an instruction.
 */
class PayMongoClient
{
    /**
     * Whether a secret key is configured at all.
     */
    public function enabled(): bool
    {
        return $this->secret() !== '';
    }

    /**
     * Open a hosted checkout for an order.
     *
     * @return array{id: string, checkout_url: string}|null null when PayMongo refuses
     */
    public function createCheckoutSession(Order $order, string $successUrl, string $cancelUrl): ?array
    {
        if (! $this->enabled()) {
            return null;
        }

        $response = $this->request()->post('/checkout_sessions', [
            'data' => [
                'attributes' => [
                    'line_items' => $this->lineItems($order),
                    'payment_method_types' => $this->methods(),
                    'success_url' => $successUrl,
                    'cancel_url' => $cancelUrl,
                    'description' => 'Order '.$order->order_number,
                    'reference_number' => $order->order_number,
                    'send_email_receipt' => false,
                    'show_description' => true,
                    'show_line_items' => true,
                    'metadata' => [
                        'order_token' => $order->token,
                        'order_number' => $order->order_number,
                    ],
                ],
            ],
        ]);

        if ($response->failed()) {
            Log::warning('paymongo.checkout_session_failed', [
                'order' => $order->order_number,
                'status' => $response->status(),
            ]);

            return null;
        }

        $id = $response->json('data.id');
        $url = $response->json('data.attributes.checkout_url');

        if (! is_string($id) || ! is_string($url)) {
            Log::warning('paymongo.checkout_session_malformed', ['order' => $order->order_number]);

            return null;
        }

        return ['id' => $id, 'checkout_url' => $url];
    }

    /**
     * Read a session back from PayMongo. This, not the guest's browser, is what
     * decides whether an order was paid.
     *
     * @return array<string, mixed>|null
     */
    public function checkoutSession(string $id): ?array
    {
        if (! $this->enabled()) {
            return null;
        }

        $response = $this->request()->get('/checkout_sessions/'.$id);

        if ($response->failed()) {
            Log::warning('paymongo.checkout_session_read_failed', [
                'reference' => $id,
                'status' => $response->status(),
            ]);

            return null;
        }

        $attributes = $response->json('data.attributes');

        return is_array($attributes) ? $attributes : null;
    }

    private function request(): PendingRequest
    {
        return Http::baseUrl($this->baseUrl())
            ->withBasicAuth($this->secret(), '')
            ->acceptJson()
            ->asJson()
            ->timeout(15)
            ->connectTimeout(5)
            ->retry(2, 250, throw: false);
    }

    /**
     * The order's own lines, so the guest sees on PayMongo what they ordered.
     *
     * @return array<int, array{name: string, amount: int, currency: string, quantity: int}>
     */
    private function lineItems(Order $order): array
    {
        return $order->items
            ->map(fn (OrderItem $item): array => [
                'name' => $item->item_name.' ('.$item->size_name.')',
                'amount' => $item->unit_price,
                'currency' => 'PHP',
                'quantity' => $item->quantity,
            ])
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function methods(): array
    {
        $methods = config('paymongo.methods');

        return is_array($methods) && $methods !== [] ? array_values($methods) : ['gcash'];
    }

    private function secret(): string
    {
        return (string) config('paymongo.secret_key');
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('paymongo.base_url'), '/');
    }
}
