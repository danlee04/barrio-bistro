<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
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
     *     days: list<array{date: string, label: string, sales: int, orders: int}>,
     *     top_items: list<array{name: string, quantity: int, sales: int}>
     * }
     */
    public function summary(int $span = 7): array
    {
        $timezone = (string) config('restaurant.timezone');
        $today = Date::now($timezone);
        $todayDate = $today->toDateString();
        $from = $today->subDays($span - 1)->toDateString();

        return [
            'today' => $this->today($todayDate),
            'days' => $this->days($from, $todayDate, $span, $timezone),
            'top_items' => $this->topItems($from, $todayDate),
        ];
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
     * @return list<array{name: string, quantity: int, sales: int}>
     */
    private function topItems(string $from, string $to): array
    {
        $rows = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', PaymentStatus::Paid->value)
            ->whereBetween('orders.business_date', [$from, $to])
            ->groupBy('order_items.item_name')
            ->selectRaw('order_items.item_name as name, SUM(order_items.quantity) as quantity, SUM(order_items.line_total) as sales')
            ->orderByDesc('quantity')
            ->orderBy('order_items.item_name')
            ->take(5)
            ->get()
            ->map(fn (object $row): array => [
                'name' => (string) $row->name,
                'quantity' => (int) $row->quantity,
                'sales' => (int) $row->sales,
            ])
            ->all();

        return array_values($rows);
    }
}
