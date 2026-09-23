<?php

use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\MenuItemSize;
use App\Models\Order;
use App\Services\OrderPlacer;
use Illuminate\Support\Facades\Date;
use Illuminate\Validation\ValidationException;

function placeLines(array $lines, OrderType $type = OrderType::DineIn, ?int $table = 7, ?string $name = null): Order
{
    return app(OrderPlacer::class)->place($type, PaymentMethod::Counter, $table, $name, $lines);
}

function lineFor(MenuItemSize $size, int $quantity = 2, ?string $note = null): array
{
    return [
        'menu_item_id' => $size->menu_item_id,
        'menu_item_size_id' => $size->id,
        'quantity' => $quantity,
        'note' => $note,
    ];
}

test('every price comes from the database and is snapshotted', function () {
    $item = MenuItem::factory()->create(['name' => 'Adobo']);
    $size = MenuItemSize::factory()->for($item, 'menuItem')->create(['name' => 'Large', 'price' => 18000]);

    $order = placeLines([lineFor($size, 3)]);

    expect($order->subtotal)->toBe(54000)
        ->and($order->total)->toBe(54000)
        ->and($order->items)->toHaveCount(1);

    $line = $order->items->first();

    expect($line->item_name)->toBe('Adobo')
        ->and($line->size_name)->toBe('Large')
        ->and($line->unit_price)->toBe(18000)
        ->and($line->line_total)->toBe(54000);
});

test('order numbers count up per business day and restart the next day', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $this->travelTo(Date::parse('2026-09-23 20:00', 'Asia/Manila'));
    $first = placeLines([lineFor($size)]);
    $second = placeLines([lineFor($size)]);

    $this->travelTo(Date::parse('2026-09-24 09:00', 'Asia/Manila'));
    $nextDay = placeLines([lineFor($size)]);

    expect($first->order_number)->toBe('BB-20260923-0001')
        ->and($second->order_number)->toBe('BB-20260923-0002')
        ->and($second->daily_number)->toBe(2)
        ->and($nextDay->order_number)->toBe('BB-20260924-0001');
});

test('a take-out order carries a name instead of a table', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $order = placeLines([lineFor($size)], OrderType::Takeout, null, 'Ana');

    expect($order->type)->toBe(OrderType::Takeout)
        ->and($order->table_number)->toBeNull()
        ->and($order->customer_name)->toBe('Ana');
});

test('a sold-out dish is refused with the line flagged', function () {
    $item = MenuItem::factory()->unavailable()->create(['name' => 'Kare-Kare']);
    $size = MenuItemSize::factory()->for($item, 'menuItem')->create(['price' => 26000]);

    expect(fn () => placeLines([lineFor($size)]))->toThrow(ValidationException::class);

    expect(Order::query()->count())->toBe(0);
});

test('archived dishes and archived categories are refused', function () {
    $archivedItem = MenuItem::factory()->create();
    $archivedSize = MenuItemSize::factory()->for($archivedItem, 'menuItem')->create(['price' => 10000]);
    $archivedItem->delete();

    $category = Category::factory()->create();
    $item = MenuItem::factory()->for($category)->create();
    $size = MenuItemSize::factory()->for($item, 'menuItem')->create(['price' => 10000]);
    $category->delete();

    expect(fn () => placeLines([lineFor($archivedSize)]))->toThrow(ValidationException::class);
    expect(fn () => placeLines([lineFor($size)]))->toThrow(ValidationException::class);
});

test('a size that belongs to another dish is refused', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);
    $other = MenuItem::factory()->create();

    $tampered = ['menu_item_id' => $other->id, 'menu_item_size_id' => $size->id, 'quantity' => 1, 'note' => null];

    expect(fn () => placeLines([$tampered]))->toThrow(ValidationException::class);
});

test('a blank note is stored as nothing at all', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $order = placeLines([lineFor($size, 1, '   ')]);

    expect($order->items->first()->note)->toBeNull();
});
