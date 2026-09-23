<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListStaffOrdersRequest;
use App\Http\Resources\StaffOrderResource;
use App\Models\Order;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Date;

class StaffOrderController extends Controller
{
    /**
     * Today's orders for whichever screen is asking. Yesterday belongs to the
     * reports, not to the queue.
     */
    public function __invoke(ListStaffOrdersRequest $request): AnonymousResourceCollection
    {
        $view = $request->string('view', 'queue')->toString();

        $query = Order::query()
            ->with(['items', 'payments'])
            ->where('business_date', Date::now((string) config('restaurant.timezone'))->toDateString());

        $orders = match ($view) {
            'kitchen' => $query
                ->whereIn('status', [OrderStatus::Confirmed, OrderStatus::Preparing, OrderStatus::Ready])
                ->where('payment_status', PaymentStatus::Paid)
                ->orderBy('id')
                ->get(),
            'done' => $query
                ->whereIn('status', [OrderStatus::Completed, OrderStatus::Cancelled])
                ->orderByDesc('id')
                ->take(100)
                ->get(),
            default => $query
                ->whereIn('status', [
                    OrderStatus::Pending,
                    OrderStatus::Confirmed,
                    OrderStatus::Preparing,
                    OrderStatus::Ready,
                ])
                ->orderByDesc('id')
                ->get(),
        };

        return StaffOrderResource::collection($orders);
    }
}
