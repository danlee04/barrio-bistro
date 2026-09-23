<?php

namespace App\Http\Controllers;

use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Http\Requests\PlaceOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderPlacer;
use Illuminate\Http\JsonResponse;

class OrderController extends Controller
{
    /**
     * Place a guest order. The request carries dishes and quantities only:
     * every price is read from the database inside the placer.
     */
    public function store(PlaceOrderRequest $request, OrderPlacer $placer): JsonResponse
    {
        $order = $placer->place(
            type: OrderType::from($request->validated('type')),
            paymentMethod: PaymentMethod::from($request->validated('payment_method')),
            tableNumber: $request->validated('table_number'),
            customerName: $request->validated('customer_name'),
            lines: $request->validated('items'),
        );

        return OrderResource::make($order)->response()->setStatusCode(201);
    }

    /**
     * One order, for whoever holds its token.
     */
    public function show(Order $order): OrderResource
    {
        return OrderResource::make($order->load('items'));
    }
}
