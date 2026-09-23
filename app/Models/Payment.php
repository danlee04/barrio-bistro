<?php

namespace App\Models;

use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use Database\Factories\PaymentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One attempt to pay an order. Retries add rows and nothing is ever
 * overwritten, so the history of a payment stays readable long after the meal.
 *
 * @property int $id
 * @property int $order_id
 * @property PaymentProvider $provider
 * @property string|null $provider_reference
 * @property string|null $provider_payment_id
 * @property string|null $method
 * @property int $amount
 * @property PaymentState $state
 * @property string|null $checkout_url
 * @property Carbon|null $paid_at
 * @property int|null $received_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Order $order
 * @property-read User|null $receiver
 */
#[Fillable([
    'provider',
    'provider_reference',
    'provider_payment_id',
    'method',
    'amount',
    'state',
    'checkout_url',
    'paid_at',
    'received_by',
])]
class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'provider_reference' => null,
        'provider_payment_id' => null,
        'method' => null,
        'state' => 'pending',
        'checkout_url' => null,
        'paid_at' => null,
        'received_by' => null,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'provider' => PaymentProvider::class,
            'state' => PaymentState::class,
            'amount' => 'integer',
            'paid_at' => 'datetime',
        ];
    }

    /**
     * The order being paid.
     *
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * The staff member who took the payment at the counter.
     *
     * @return BelongsTo<User, $this>
     */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
