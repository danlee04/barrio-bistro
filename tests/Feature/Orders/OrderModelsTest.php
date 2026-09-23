<?php

use App\Enums\OrderStatus;
use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\MenuItemSize;
use App\Models\Order;
use Illuminate\Database\UniqueConstraintViolationException;

function line(MenuItemSize $size, int $quantity = 2): array
{
    return [
        'menu_item_id' => $size->menu_item_id,
        'menu_item_size_id' => $size->id,
        'item_name' => 'Adobo',
        'size_name' => $size->name,
        'unit_price' => $size->price,
        'quantity' => $quantity,
        'line_total' => $size->price * $quantity,
    ];
}

test('an order is keyed by an opaque token, never by its id', function () {
    $order = Order::factory()->create();

    expect($order->token)->toHaveLength(26)
        ->and($order->getRouteKeyName())->toBe('token')
        ->and($order->getRouteKey())->toBe($order->token)
        ->and($order->id)->toBeInt();
});

test('an order casts its tracks and money', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);

    expect($order->type)->toBe(OrderType::DineIn)
        ->and($order->status)->toBe(OrderStatus::Pending)
        ->and($order->payment_status)->toBe(PaymentStatus::Unpaid)
        ->and($order->payment_method)->toBe(PaymentMethod::Counter)
        ->and($order->total)->toBe(36000);
});

test('a line keeps its snapshot when the menu price changes later', function () {
    $size = MenuItemSize::factory()->create(['name' => 'Large', 'price' => 18000]);
    $order = Order::factory()->create();
    $order->items()->create(line($size));

    $size->update(['price' => 25000]);

    expect($order->items()->sole()->unit_price)->toBe(18000)
        ->and($order->items()->sole()->line_total)->toBe(36000);
});

test('a line survives the size being removed from the menu', function () {
    $size = MenuItemSize::factory()->create(['name' => 'Large', 'price' => 18000]);
    $order = Order::factory()->create();
    $order->items()->create(line($size));

    $size->delete();

    $item = $order->items()->sole();

    expect($item->menu_item_size_id)->toBeNull()
        ->and($item->size_name)->toBe('Large')
        ->and($item->item_name)->toBe('Adobo');
});

test('two orders on the same day cannot share a daily number', function () {
    $first = Order::factory()->create(['business_date' => '2026-09-23', 'daily_number' => 1]);

    expect(fn () => Order::factory()->create([
        'business_date' => '2026-09-23',
        'daily_number' => 1,
        'order_number' => $first->order_number.'-copy',
    ]))->toThrow(UniqueConstraintViolationException::class);
});
