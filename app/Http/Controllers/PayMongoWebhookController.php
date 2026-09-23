<?php

namespace App\Http\Controllers;

use App\Enums\PaymentProvider;
use App\Models\Payment;
use App\Services\PaymentConfirmer;
use App\Services\PayMongoClient;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayMongoWebhookController extends Controller
{
    /**
     * A signed event only tells us *where to look*. What actually happened is
     * read back from PayMongo, so a forged body can never pay an order.
     */
    public function __invoke(Request $request, PayMongoClient $paymongo, PaymentConfirmer $confirmer): JsonResponse
    {
        $reference = $request->input('data.attributes.data.id');
        $token = $request->input('data.attributes.data.attributes.metadata.order_token');

        $payment = $this->findPayment(
            is_string($reference) ? $reference : null,
            is_string($token) ? $token : null,
        );

        if ($payment !== null && $payment->provider_reference !== null) {
            $session = $paymongo->checkoutSession($payment->provider_reference);

            if ($session !== null) {
                $confirmer->confirmOnline($payment, $session);
            }
        }

        return response()->json(['received' => true]);
    }

    /**
     * Match the event to an attempt of ours, by its checkout session or by the
     * order token we sent along as metadata.
     */
    private function findPayment(?string $reference, ?string $token): ?Payment
    {
        $payment = $reference === null
            ? null
            : Payment::query()->where('provider_reference', $reference)->first();

        if ($payment !== null || $token === null) {
            return $payment;
        }

        return Payment::query()
            ->where('provider', PaymentProvider::PayMongo)
            ->whereHas('order', fn (Builder $query) => $query->where('token', $token))
            ->latest('id')
            ->first();
    }
}
