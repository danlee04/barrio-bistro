<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SalesReport;
use Illuminate\Http\JsonResponse;

class ReportsController extends Controller
{
    /**
     * The dashboard's whole read. The route group already keeps this to admins.
     */
    public function __invoke(SalesReport $report): JsonResponse
    {
        return response()->json(['data' => $report->summary()]);
    }
}
