<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\MenuItem;
use App\Models\Order;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;

/**
 * Every number the dashboard shows, read in one pass. Sales mean paid orders:
 * an order nobody paid for never becomes money.
 */
class SalesReport
{
    /**
     * @return array{
     *     today: array{date: string, sales: int, orders: int, paid_orders: int, cancelled_orders: int, average_order: int},
     *     pace: array{yesterday: int, yesterday_full: int},
     *     days: list<array{date: string, label: string, sales: int, orders: int}>,
     *     hours: list<array{hour: int, label: string, orders: int}>,
     *     top_items: list<array{name: string, quantity: int, sales: int, image: array{sm: string, md: string}|null}>
     * }
     */
    public function summary(int $span = 7): array
    {
        $timezone = (string) config('restaurant.timezone');
        $todayDate = Date::now($timezone)->toDateString();
        $from = Date::now($timezone)->subDays($span - 1)->toDateString();

        return [
            'today' => $this->today($todayDate),
            'pace' => $this->pace($timezone),
            'days' => $this->days($from, $todayDate, $span, $timezone),
            'hours' => $this->hours($from, $todayDate, $timezone),
            'top_items' => $this->topItems($from, $todayDate),
        ];
    }

    /**
     * Today's takings mean nothing on their own, so yesterday is measured to
     * the same minute: a quiet Tuesday morning is not a bad day yet.
     *
     * @return array{yesterday: int, yesterday_full: int}
     */
    private function pace(string $timezone): array
    {
        $now = Date::now($timezone);
        $yesterday = Date::now($timezone)->subDay()->toDateString();

        return [
            'yesterday' => $this->paidUpTo($yesterday, $timezone, $now->format('H:i:s')),
            'yesterday_full' => (int) Order::query()
                ->where('business_date', $yesterday)
                ->where('payment_status', PaymentStatus::Paid)
                ->sum('total'),
        ];
    }

    /**
     * Paid takings on one day, counting only what was ordered before the given
     * time of day. The clock is read in PHP so MySQL and SQLite agree.
     */
    private function paidUpTo(string $date, string $timezone, string $cutoff): int
    {
        return (int) Order::query()
            ->where('business_date', $date)
            ->where('payment_status', PaymentStatus::Paid)
            ->get(['total', 'created_at'])
            ->filter(fn (Order $order): bool => $order->created_at !== null
                && $order->created_at->setTimezone($timezone)->format('H:i:s') <= $cutoff)
            ->sum('total');
    }

    /**
     * When the shop fills up, counted across the whole window rather than
     * today alone: one day is a rumour, a week is a pattern. Empty hours in
     * the middle are kept so the shape of the day is honest.
     *
     * @return list<array{hour: int, label: string, orders: int}>
     */
    private function hours(string $from, string $to, string $timezone): array
    {
        $counts = [];

        foreach (Order::query()
            ->whereBetween('business_date', [$from, $to])
            ->where('payment_status', PaymentStatus::Paid)
            ->get(['created_at']) as $order) {
            if ($order->created_at === null) {
                continue;
            }

            $hour = (int) $order->created_at->setTimezone($timezone)->format('G');
            $counts[$hour] = ($counts[$hour] ?? 0) + 1;
        }

        if ($counts === []) {
            return [];
        }

        $hours = [];

        for ($hour = min(array_keys($counts)); $hour <= max(array_keys($counts)); $hour++) {
            $hours[] = [
                'hour' => $hour,
                'label' => $this->clockLabel($hour),
                'orders' => $counts[$hour] ?? 0,
            ];
        }

        return $hours;
    }

    /**
     * An hour of the day the way a person says it: 0 is 12am, 13 is 1pm.
     */
    private function clockLabel(int $hour): string
    {
        return ($hour % 12 === 0 ? 12 : $hour % 12).($hour < 12 ? 'am' : 'pm');
    }

    /**
     * @return array{date: string, sales: int, orders: int, paid_orders: int, cancelled_orders: int, average_order: int}
     */
    private function today(string $date): array
    {
        $paid = Order::query()
            ->where('business_date', $date)
            ->where('payment_status', PaymentStatus::Paid);

        $sales = (int) (clone $paid)->sum('total');
        $paidOrders = (clone $paid)->count();

        return [
            'date' => $date,
            'sales' => $sales,
            'orders' => Order::query()->where('business_date', $date)->count(),
            'paid_orders' => $paidOrders,
            'cancelled_orders' => Order::query()
                ->where('business_date', $date)
                ->where('status', OrderStatus::Cancelled)
                ->count(),
            'average_order' => $paidOrders === 0 ? 0 : intdiv($sales, $paidOrders),
        ];
    }

    /**
     * Every day in the window, including the ones nobody bought anything on.
     *
     * @return list<array{date: string, label: string, sales: int, orders: int}>
     */
    private function days(string $from, string $to, int $span, string $timezone): array
    {
        $rows = DB::table('orders')
            ->where('payment_status', PaymentStatus::Paid->value)
            ->whereBetween('business_date', [$from, $to])
            ->groupBy('business_date')
            ->selectRaw('business_date, SUM(total) as sales, COUNT(*) as orders')
            ->get()
            ->keyBy('business_date');

        $days = [];

        for ($back = $span - 1; $back >= 0; $back--) {
            $day = Date::now($timezone)->subDays($back);
            $date = $day->toDateString();
            $row = $rows->get($date);

            $days[] = [
                'date' => $date,
                'label' => $day->format('D'),
                'sales' => (int) ($row->sales ?? 0),
                'orders' => (int) ($row->orders ?? 0),
            ];
        }

        return $days;
    }

    /**
     * The busiest dishes of the window, with their sizes added together.
     *
     * Lines keep the name they were sold under, so a renamed dish stays
     * counted; the photo is looked up from whichever menu item the line still
     * points at, archived or not, and is simply missing if it points at none.
     *
     * @return list<array{name: string, quantity: int, sales: int, image: array{sm: string, md: string}|null}>
     */
    private function topItems(string $from, string $to): array
    {
        $rows = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', PaymentStatus::Paid->value)
            ->whereBetween('orders.business_date', [$from, $to])
            ->groupBy('order_items.item_name')
            ->selectRaw('order_items.item_name as name, SUM(order_items.quantity) as quantity, SUM(order_items.line_total) as sales, MAX(order_items.menu_item_id) as menu_item_id')
            ->orderByDesc('quantity')
            ->orderBy('order_items.item_name')
            ->take(5)
            ->get();

        $images = $this->imagesFor($rows->pluck('menu_item_id')->all());

        return array_values($rows->map(fn (object $row): array => [
            'name' => (string) $row->name,
            'quantity' => (int) $row->quantity,
            'sales' => (int) $row->sales,
            'image' => $images[(int) $row->menu_item_id] ?? null,
        ])->all());
    }

    /**
     * Photo URLs for the given menu items, in one query.
     *
     * @param  array<array-key, mixed>  $ids
     * @return array<int, array{sm: string, md: string}>
     */
    private function imagesFor(array $ids): array
    {
        $wanted = array_filter(array_map('intval', array_filter($ids, 'is_numeric')));

        if ($wanted === []) {
            return [];
        }

        return MenuItem::withTrashed()
            ->whereIn('id', $wanted)
            ->whereNotNull('image_path')
            ->get(['id', 'image_path'])
            ->mapWithKeys(fn (MenuItem $item): array => [$item->id => $item->imageUrls()])
            ->filter()
            ->all();
    }
}
