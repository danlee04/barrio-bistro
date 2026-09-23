<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Support\Facades\Date;

function soldOrder(
    int $total,
    ?string $date = null,
    PaymentStatus $payment = PaymentStatus::Paid,
    OrderStatus $status = OrderStatus::Completed,
): Order {
    $order = Order::factory()->create([
        'business_date' => $date ?? Date::now('Asia/Manila')->toDateString(),
        'subtotal' => $total,
        'total' => $total,
    ]);

    $order->status = $status;
    $order->payment_status = $payment;
    $order->save();

    return $order;
}

function soldLine(Order $order, string $name, string $sizeName, int $unitPrice, int $quantity): void
{
    OrderItem::factory()->for($order)->create([
        'item_name' => $name,
        'size_name' => $sizeName,
        'unit_price' => $unitPrice,
        'quantity' => $quantity,
        'line_total' => $unitPrice * $quantity,
    ]);
}

test('today counts paid orders only', function () {
    soldOrder(36000);
    soldOrder(20000);
    soldOrder(99900, payment: PaymentStatus::Unpaid, status: OrderStatus::Pending);
    soldOrder(50000, payment: PaymentStatus::Unpaid, status: OrderStatus::Cancelled);

    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertOk()
        ->assertJsonPath('data.today.sales', 56000)
        ->assertJsonPath('data.today.paid_orders', 2)
        ->assertJsonPath('data.today.orders', 4)
        ->assertJsonPath('data.today.cancelled_orders', 1)
        ->assertJsonPath('data.today.average_order', 28000);
});

test('an empty day reports zeroes rather than nothing', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertOk()
        ->assertJsonPath('data.today.sales', 0)
        ->assertJsonPath('data.today.average_order', 0)
        ->assertJsonCount(7, 'data.days')
        ->assertJsonCount(0, 'data.top_items');
});

test('the week holds seven days, oldest first, with the quiet ones at zero', function () {
    $today = Date::now('Asia/Manila');

    soldOrder(10000, $today->toDateString());
    soldOrder(25000, $today->subDays(2)->toDateString());
    soldOrder(90000, $today->subDays(9)->toDateString());

    $response = $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertOk();

    $days = $response->json('data.days');

    expect($days)->toHaveCount(7)
        ->and($days[0]['date'])->toBe($today->subDays(6)->toDateString())
        ->and($days[6]['date'])->toBe($today->toDateString())
        ->and($days[6]['sales'])->toBe(10000)
        ->and($days[4]['sales'])->toBe(25000)
        ->and($days[1]['sales'])->toBe(0)
        ->and(array_sum(array_column($days, 'sales')))->toBe(35000);
});

test('top dishes add their sizes together and lead with the busiest', function () {
    $first = soldOrder(50000);
    soldLine($first, 'Adobo', 'Regular', 18000, 2);
    soldLine($first, 'Adobo', 'Large', 24000, 1);
    soldLine($first, 'Sisig', 'Regular', 22000, 1);

    $unpaid = soldOrder(18000, payment: PaymentStatus::Unpaid, status: OrderStatus::Pending);
    soldLine($unpaid, 'Lumpia', 'Regular', 18000, 9);

    $response = $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertOk()
        ->assertJsonPath('data.top_items.0.name', 'Adobo')
        ->assertJsonPath('data.top_items.0.quantity', 3)
        ->assertJsonPath('data.top_items.0.sales', 60000)
        ->assertJsonPath('data.top_items.1.name', 'Sisig');

    expect($response->json('data.top_items'))->toHaveCount(2);
});

test('only an admin reads the money', function () {
    $this->getJson('/api/v1/admin/reports/summary')->assertUnauthorized();

    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertForbidden();

    $this->actingAs(User::factory()->kitchen()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertForbidden();
});

test('staff are told whether the reports are theirs to open', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.view_reports', true);

    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.view_reports', false);
});
