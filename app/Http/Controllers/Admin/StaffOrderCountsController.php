<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;

class StaffOrderCountsController extends Controller
{
    /**
     * How much is waiting, for the badges in the sidebar.
     *
     * Counts rather than the orders themselves: every admin screen asks for
     * this on a timer, and nobody needs the dishes to know there is work.
     * Three counts against today's rows, which the status index already covers.
     */
    public function __invoke(): JsonResponse
    {
        $date = Date::now((string) config('restaurant.timezone'))->toDateString();

        /** @return Builder<Order> */
        $today = fn (): Builder => Order::query()->where('business_date', $date);

        $paid = fn (Builder $query): Builder => $query
            ->where('payment_status', PaymentStatus::Paid);

        return response()->json(['data' => [
            // Everything the counter still has on its hands.
            'queue' => $today()->whereIn('status', [
                OrderStatus::Pending,
                OrderStatus::Confirmed,
                OrderStatus::Preparing,
                OrderStatus::Ready,
            ])->count(),

            // What the kitchen board shows: paid, and not handed over yet.
            'kitchen' => $paid($today()->whereIn('status', [
                OrderStatus::Confirmed,
                OrderStatus::Preparing,
                OrderStatus::Ready,
            ]))->count(),

            // Just arrived, and nobody has started cooking it.
            'kitchen_new' => $paid(
                $today()->where('status', OrderStatus::Confirmed),
            )->count(),
        ]]);
    }
}
