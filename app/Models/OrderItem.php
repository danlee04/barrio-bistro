<?php

namespace App\Models;

use Database\Factories\OrderItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A line as it was ordered: the names and the price are copies, so editing the
 * menu later never rewrites an old order.
 *
 * @property int $id
 * @property int $order_id
 * @property int|null $menu_item_id
 * @property int|null $menu_item_size_id
 * @property string $item_name
 * @property string $size_name
 * @property int $unit_price
 * @property int $quantity
 * @property int $line_total
 * @property string|null $note
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Order $order
 */
#[Fillable([
    'menu_item_id',
    'menu_item_size_id',
    'item_name',
    'size_name',
    'unit_price',
    'quantity',
    'line_total',
    'note',
])]
class OrderItem extends Model
{
    /** @use HasFactory<OrderItemFactory> */
    use HasFactory;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'menu_item_id' => null,
        'menu_item_size_id' => null,
        'note' => null,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'unit_price' => 'integer',
            'quantity' => 'integer',
            'line_total' => 'integer',
        ];
    }

    /**
     * The order this line belongs to.
     *
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
