<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SalesReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;

class ReportsController extends Controller implements HasMiddleware
{
    /**
     * @return list<Middleware>
     */
    public static function middleware(): array
    {
        return [new Middleware('role:admin')];
    }

    /**
     * The dashboard's whole read. The route group already keeps this to admins.
     */
    public function __invoke(SalesReport $report): JsonResponse
    {
        return response()->json(['data' => $report->summary()]);
    }
}
