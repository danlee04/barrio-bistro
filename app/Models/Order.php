<?php

namespace App\Models;

use App\Enums\OrderStatus;
use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A guest's order. Only the fields a guest chooses are fillable: the numbers,
 * the money and both tracks are set by the server alone.
 *
 * `business_date` stays a plain `Y-m-d` string rather than a date cast, so the
 * daily counter compares the same value on MySQL and on SQLite.
 *
 * @property int $id
 * @property string $token
 * @property string $order_number
 * @property string $business_date
 * @property int $daily_number
 * @property OrderType $type
 * @property int|null $table_number
 * @property string|null $customer_name
 * @property OrderStatus $status
 * @property PaymentStatus $payment_status
 * @property PaymentMethod $payment_method
 * @property int $subtotal
 * @property int $total
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, OrderItem> $items
 */
#[Fillable(['type', 'table_number', 'customer_name', 'payment_method'])]
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory, HasUlids;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'table_number' => null,
        'customer_name' => null,
        'status' => OrderStatus::Pending->value,
        'payment_status' => PaymentStatus::Unpaid->value,
    ];

    /**
     * The guest only ever holds the token, so route binding uses it.
     */
    public function getRouteKeyName(): string
    {
        return 'token';
    }

    /**
     * The ULID goes in `token`; the primary key stays an auto-incrementing id.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['token'];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'daily_number' => 'integer',
            'type' => OrderType::class,
            'table_number' => 'integer',
            'status' => OrderStatus::class,
            'payment_status' => PaymentStatus::class,
            'payment_method' => PaymentMethod::class,
            'subtotal' => 'integer',
            'total' => 'integer',
        ];
    }

    /**
     * The snapshotted lines, in the order the guest built them.
     *
     * @return HasMany<OrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class)->orderBy('id');
    }
}
