<?php

namespace App\Services;

use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Models\MenuItemSize;
use App\Models\Order;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Turns a guest's cart into an order. Every price is read here, from the
 * database, so a tampered cart can only ever change quantities.
 */
class OrderPlacer
{
    /**
     * Place an order, or fail with the offending line flagged.
     *
     * @param  array<int, array{menu_item_id: int, menu_item_size_id: int, quantity: int, note?: string|null}>  $lines
     *
     * @throws ValidationException
     */
    public function place(
        OrderType $type,
        PaymentMethod $paymentMethod,
        ?int $tableNumber,
        ?string $customerName,
        array $lines,
    ): Order {
        $priced = $this->price($lines, $this->sizesFor($lines));

        return retry(
            3,
            fn (): Order => DB::transaction(
                fn (): Order => $this->store($type, $paymentMethod, $tableNumber, $customerName, $priced),
            ),
            0,
            fn (Throwable $e): bool => $e instanceof UniqueConstraintViolationException,
        );
    }

    /**
     * Load every size the cart points at, with its dish and category.
     *
     * @param  array<int, array<string, mixed>>  $lines
     * @return Collection<int|string, MenuItemSize>
     */
    private function sizesFor(array $lines): Collection
    {
        return MenuItemSize::query()
            ->with(['menuItem.category'])
            ->whereIn('id', array_column($lines, 'menu_item_size_id'))
            ->get()
            ->keyBy('id');
    }

    /**
     * Price each line from the database, refusing anything a guest can no
     * longer order.
     *
     * @param  array<int, array{menu_item_id: int, menu_item_size_id: int, quantity: int, note?: string|null}>  $lines
     * @param  Collection<int|string, MenuItemSize>  $sizes
     * @return array<int, array{menu_item_id: int, menu_item_size_id: int, item_name: string, size_name: string, unit_price: int, quantity: int, line_total: int, note: string|null}>
     *
     * @throws ValidationException
     */
    private function price(array $lines, Collection $sizes): array
    {
        $priced = [];

        foreach (array_values($lines) as $index => $line) {
            $size = $sizes->get($line['menu_item_size_id']);
            $item = $size?->menuItem;

            if ($size === null || $item === null || $size->menu_item_id !== (int) $line['menu_item_id']) {
                throw ValidationException::withMessages([
                    "items.{$index}.menu_item_size_id" => 'That dish is no longer on the menu.',
                ]);
            }

            if (! $item->is_available || $item->category->trashed()) {
                throw ValidationException::withMessages([
                    "items.{$index}.menu_item_size_id" => "{$item->name} is sold out today.",
                ]);
            }

            $quantity = (int) $line['quantity'];
            $note = trim((string) ($line['note'] ?? ''));

            $priced[] = [
                'menu_item_id' => $item->id,
                'menu_item_size_id' => $size->id,
                'item_name' => $item->name,
                'size_name' => $size->name,
                'unit_price' => $size->price,
                'quantity' => $quantity,
                'line_total' => $size->price * $quantity,
                'note' => $note === '' ? null : $note,
            ];
        }

        return $priced;
    }

    /**
     * Write the order and its lines, taking the next number of the business day.
     *
     * @param  array<int, array{menu_item_id: int, menu_item_size_id: int, item_name: string, size_name: string, unit_price: int, quantity: int, line_total: int, note: string|null}>  $priced
     */
    private function store(
        OrderType $type,
        PaymentMethod $paymentMethod,
        ?int $tableNumber,
        ?string $customerName,
        array $priced,
    ): Order {
        $today = Date::now((string) config('restaurant.timezone'));

        $dailyNumber = (int) Order::query()
            ->where('business_date', $today->toDateString())
            ->lockForUpdate()
            ->max('daily_number') + 1;

        $subtotal = (int) array_sum(array_column($priced, 'line_total'));

        $order = new Order([
            'type' => $type,
            'table_number' => $tableNumber,
            'customer_name' => $customerName,
            'payment_method' => $paymentMethod,
        ]);

        $order->order_number = sprintf(
            '%s-%s-%04d',
            (string) config('restaurant.order_prefix'),
            $today->format('Ymd'),
            $dailyNumber,
        );
        $order->business_date = $today->toDateString();
        $order->daily_number = $dailyNumber;
        $order->subtotal = $subtotal;
        $order->total = $subtotal;
        $order->save();

        $order->items()->createMany($priced);

        return $order->load('items');
    }
}
