<?php

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Str;

test('a guest reads their order with the token', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    OrderItem::factory()->for($order)->create([
        'item_name' => 'Adobo',
        'size_name' => 'Regular',
        'unit_price' => 18000,
        'quantity' => 2,
        'line_total' => 36000,
    ]);

    $this->getJson("/api/v1/orders/{$order->token}")
        ->assertOk()
        ->assertJsonPath('data.order_number', $order->order_number)
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.status_label', 'Waiting for payment')
        ->assertJsonPath('data.items.0.item_name', 'Adobo')
        ->assertJsonPath('data.total', 36000)
        ->assertJsonMissingPath('data.id');
});

test('a token nobody was given is a 404', function () {
    Order::factory()->create();

    $this->getJson('/api/v1/orders/'.Str::ulid())->assertNotFound();
    $this->getJson('/api/v1/orders/not-a-token')->assertNotFound();
});

test('the guest sees the status the staff set', function () {
    $order = Order::factory()->create();

    // `status` is not fillable: only the staff screens in Module 6 move it,
    // and they will set it the same way.
    $order->status = OrderStatus::Preparing;
    $order->save();

    $this->getJson("/api/v1/orders/{$order->token}")
        ->assertOk()
        ->assertJsonPath('data.status', 'preparing')
        ->assertJsonPath('data.status_label', 'Preparing');
});
