<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The only place that writes `paid`. Both the webhook and the guest's return
 * come through here, and both hand over what PayMongo itself said — never what
 * a browser claimed.
 */
class PaymentConfirmer
{
    /**
     * Settle an online attempt against a checkout session read from PayMongo.
     *
     * @param  array<string, mixed>  $session  the session's `attributes`
     * @return bool whether the order is paid once this returns
     */
    public function confirmOnline(Payment $payment, array $session): bool
    {
        if ($payment->state === PaymentState::Paid) {
            return true;
        }

        $paid = null;

        foreach ((array) data_get($session, 'payments', []) as $entry) {
            if (data_get($entry, 'attributes.status') === 'paid') {
                $paid = $entry;

                break;
            }
        }

        if ($paid === null) {
            return false;
        }

        $order = $payment->order;
        $amount = (int) data_get($paid, 'attributes.amount');

        if ($amount !== $order->total) {
            AuditLog::record('payment.amount_mismatch', $order, context: [
                'expected' => $order->total,
                'received' => $amount,
                'reference' => $payment->provider_reference,
            ]);

            return false;
        }

        DB::transaction(function () use ($payment, $order, $paid, $amount): void {
            $payment->fill([
                'state' => PaymentState::Paid,
                'method' => (string) data_get($paid, 'attributes.source.type', 'online'),
                'provider_payment_id' => (string) data_get($paid, 'id'),
                'paid_at' => now(),
            ])->save();

            $this->markOrderPaid($order, PaymentMethod::Online);

            AuditLog::record('order.paid', $order, context: [
                'provider' => PaymentProvider::PayMongo->value,
                'amount' => $amount,
                'reference' => $payment->provider_reference,
            ]);
        });

        return true;
    }

    /**
     * Record money handed over at the counter.
     *
     * @throws ValidationException
     */
    public function confirmAtCounter(Order $order, User $cashier): Payment
    {
        if ($order->payment_status === PaymentStatus::Paid) {
            throw ValidationException::withMessages(['order' => 'This order is already paid.']);
        }

        if ($order->status === OrderStatus::Cancelled) {
            throw ValidationException::withMessages(['order' => 'This order was cancelled.']);
        }

        return DB::transaction(function () use ($order, $cashier): Payment {
            $payment = $order->payments()->create([
                'provider' => PaymentProvider::Counter,
                'method' => 'counter',
                'amount' => $order->total,
                'state' => PaymentState::Paid,
                'paid_at' => now(),
                'received_by' => $cashier->getAuthIdentifier(),
            ]);

            $this->markOrderPaid($order, PaymentMethod::Counter);

            AuditLog::record('order.paid', $order, $cashier, [
                'provider' => PaymentProvider::Counter->value,
                'amount' => $order->total,
            ]);

            return $payment;
        });
    }

    /**
     * Paying lifts a waiting order to confirmed, and leaves a cooking one alone.
     */
    private function markOrderPaid(Order $order, PaymentMethod $method): void
    {
        $order->payment_status = PaymentStatus::Paid;
        $order->payment_method = $method;

        if ($order->status === OrderStatus::Pending) {
            $order->status = OrderStatus::Confirmed;
        }

        $order->save();
    }
}
