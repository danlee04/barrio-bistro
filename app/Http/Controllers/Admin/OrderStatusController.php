<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateOrderStatusRequest;
use App\Http\Resources\StaffOrderResource;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderTransitioner;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;

class OrderStatusController extends Controller
{
    /**
     * Move an order one step along.
     */
    public function __invoke(
        UpdateOrderStatusRequest $request,
        Order $order,
        #[CurrentUser] User $user,
        OrderTransitioner $transitioner,
    ): StaffOrderResource {
        $to = OrderStatus::from($request->validated('status'));

        Gate::authorize('transition', [$order, $to]);

        $transitioner->move($order, $to, $user, $request->validated('reason'));

        return StaffOrderResource::make($order->refresh()->load(['items', 'payments']));
    }
}
