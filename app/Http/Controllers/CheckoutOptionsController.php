<?php

namespace App\Http\Controllers;

use App\Services\PayMongoClient;
use Illuminate\Http\JsonResponse;

class CheckoutOptionsController extends Controller
{
    /**
     * What the cart may offer a guest: how high table numbers go, which ways
     * they can pay, and the smallest order PayMongo will take.
     */
    public function __invoke(PayMongoClient $paymongo): JsonResponse
    {
        $methods = ['counter'];

        if ($paymongo->enabled()) {
            $methods[] = 'online';
        }

        return response()->json([
            'data' => [
                'tables' => (int) config('restaurant.tables'),
                'methods' => $methods,
                'online_minimum' => (int) config('paymongo.minimum_amount'),
            ],
        ]);
    }
}
