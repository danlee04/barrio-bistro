<?php

namespace App\Http\Controllers;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use App\Enums\PaymentStatus;
use App\Http\Resources\OrderResource;
use App\Http\Resources\PaymentResource;
use App\Models\Order;
use App\Services\PaymentConfirmer;
use App\Services\PayMongoClient;
use Illuminate\Http\JsonResponse;

class OrderPaymentController extends Controller
{
    /**
     * Open a PayMongo checkout for an order. Every attempt is its own row, so a
     * guest who gives up and tries again leaves a readable trail.
     */
    public function session(Order $order, PayMongoClient $paymongo): JsonResponse
    {
        if ($order->payment_status === PaymentStatus::Paid || $order->status === OrderStatus::Cancelled) {
            return response()->json([
                'message' => 'This order cannot be paid online any more.',
                'code' => 'order_not_payable',
            ], 422);
        }

        if (! $paymongo->enabled()) {
            return response()->json([
                'message' => 'Online payment is not available right now. Please pay at the counter.',
                'code' => 'online_payment_unavailable',
            ], 503);
        }

        if ($order->total < (int) config('paymongo.minimum_amount')) {
            return response()->json([
                'message' => 'This order is too small to pay online. Please pay at the counter.',
                'code' => 'below_online_minimum',
            ], 422);
        }

        $session = $paymongo->createCheckoutSession(
            $order->load('items'),
            url('/order/'.$order->token.'?paid=1'),
            url('/order/'.$order->token),
        );

        if ($session === null) {
            return response()->json([
                'message' => 'We could not reach the payment provider. Please try again or pay at the counter.',
                'code' => 'online_payment_unavailable',
            ], 503);
        }

        // A new session is a new attempt; the same session handed back twice is
        // still one attempt.
        $payment = $order->payments()->updateOrCreate(
            ['provider_reference' => $session['id']],
            [
                'provider' => PaymentProvider::PayMongo,
                'amount' => $order->total,
                'checkout_url' => $session['checkout_url'],
            ],
        );

        $order->payment_method = PaymentMethod::Online;
        $order->save();

        return PaymentResource::make($payment)->response()->setStatusCode(201);
    }

    /**
     * The guest is back from PayMongo. Their browser's word means nothing here:
     * the server asks PayMongo directly how the session ended.
     */
    public function refresh(Order $order, PayMongoClient $paymongo, PaymentConfirmer $confirmer): OrderResource
    {
        $payment = $order->payments()
            ->where('provider', PaymentProvider::PayMongo)
            ->whereNotNull('provider_reference')
            ->first();

        if ($payment !== null && $payment->state !== PaymentState::Paid) {
            $session = $paymongo->checkoutSession((string) $payment->provider_reference);

            if ($session !== null) {
                $confirmer->confirmOnline($payment, $session);
            }
        }

        return OrderResource::make($order->refresh()->load('items'));
    }
}
