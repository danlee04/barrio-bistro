<?php

use App\Models\MenuItem;
use App\Models\MenuItemSize;
use App\Models\Order;

function orderPayload(MenuItemSize $size, array $overrides = []): array
{
    return array_replace([
        'type' => 'dine_in',
        'table_number' => 7,
        'customer_name' => null,
        'payment_method' => 'counter',
        'items' => [[
            'menu_item_id' => $size->menu_item_id,
            'menu_item_size_id' => $size->id,
            'quantity' => 2,
            'note' => 'Walang sibuyas',
        ]],
    ], $overrides);
}

test('a guest places a dine-in order and gets a token back', function () {
    $item = MenuItem::factory()->create(['name' => 'Adobo']);
    $size = MenuItemSize::factory()->for($item, 'menuItem')->create(['name' => 'Large', 'price' => 18000]);

    $response = $this->postJson('/api/v1/orders', orderPayload($size))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.payment_status', 'unpaid')
        ->assertJsonPath('data.table_number', 7)
        ->assertJsonPath('data.total', 36000)
        ->assertJsonPath('data.items.0.item_name', 'Adobo')
        ->assertJsonPath('data.items.0.size_name', 'Large')
        ->assertJsonPath('data.items.0.note', 'Walang sibuyas')
        ->assertJsonMissingPath('data.id');

    expect($response->json('data.token'))->toHaveLength(26);
    expect(Order::query()->sole()->total)->toBe(36000);
});

test('prices sent by the browser are ignored', function () {
    $size = MenuItemSize::factory()->create(['price' => 18000]);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'items' => [[
            'menu_item_id' => $size->menu_item_id,
            'menu_item_size_id' => $size->id,
            'quantity' => 2,
            'unit_price' => 1,
            'line_total' => 2,
            'price' => 1,
        ]],
        'subtotal' => 2,
        'total' => 2,
    ]))
        ->assertCreated()
        ->assertJsonPath('data.total', 36000)
        ->assertJsonPath('data.items.0.unit_price', 18000);
});

test('dine-in refuses a table the restaurant does not have', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $this->postJson('/api/v1/orders', orderPayload($size, ['table_number' => 99]))
        ->assertJsonValidationErrors(['table_number']);

    expect(Order::query()->count())->toBe(0);
});

test('a dine-in order at the counter carries a name instead of a table', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'table_number' => null,
        'customer_name' => 'Ana',
    ]))
        ->assertCreated()
        ->assertJsonPath('data.type', 'dine_in')
        ->assertJsonPath('data.table_number', null)
        ->assertJsonPath('data.customer_name', 'Ana');
});

test('a dine-in order with neither a table nor a name is refused', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'table_number' => null,
        'customer_name' => null,
    ]))->assertJsonValidationErrors(['table_number', 'customer_name']);

    expect(Order::query()->count())->toBe(0);
});

test('take-out needs a name and drops the table', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $this->postJson('/api/v1/orders', orderPayload($size, ['type' => 'takeout', 'customer_name' => null]))
        ->assertJsonValidationErrors(['customer_name']);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'type' => 'takeout',
        'table_number' => 7,
        'customer_name' => 'Ana',
    ]))
        ->assertCreated()
        ->assertJsonPath('data.type', 'takeout')
        ->assertJsonPath('data.customer_name', 'Ana')
        ->assertJsonPath('data.table_number', null);
});

test('an order cannot be bigger than the kitchen can take', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);
    $line = ['menu_item_id' => $size->menu_item_id, 'menu_item_size_id' => $size->id, 'quantity' => 1];

    $this->postJson('/api/v1/orders', orderPayload($size, ['items' => array_fill(0, 31, $line)]))
        ->assertJsonValidationErrors(['items']);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'items' => [array_replace($line, ['quantity' => 21])],
    ]))->assertJsonValidationErrors(['items.0.quantity']);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'items' => [array_replace($line, ['note' => str_repeat('a', 121)])],
    ]))->assertJsonValidationErrors(['items.0.note']);

    $this->postJson('/api/v1/orders', orderPayload($size, ['items' => []]))
        ->assertJsonValidationErrors(['items']);
});

test('a dish that sold out while the cart was open flags its own line', function () {
    $item = MenuItem::factory()->unavailable()->create();
    $size = MenuItemSize::factory()->for($item, 'menuItem')->create(['price' => 10000]);

    $this->postJson('/api/v1/orders', orderPayload($size))
        ->assertJsonValidationErrors(['items.0.menu_item_size_id']);

    expect(Order::query()->count())->toBe(0);
});

test('one phone cannot spam the kitchen with orders', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    foreach (range(1, 30) as $attempt) {
        $this->postJson('/api/v1/orders', orderPayload($size))->assertCreated();
    }

    $this->postJson('/api/v1/orders', orderPayload($size))->assertTooManyRequests();
});
