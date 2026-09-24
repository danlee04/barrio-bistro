<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreInquiryRequest;
use App\Models\AuditLog;
use App\Models\Inquiry;
use Illuminate\Http\JsonResponse;

class InquiryController extends Controller
{
    /**
     * Take a message from the website. Nothing comes back but a thank you:
     * what was written is personal, and only staff read it again.
     */
    public function store(StoreInquiryRequest $request): JsonResponse
    {
        $inquiry = Inquiry::query()->create($request->safe()->except('website'));

        AuditLog::record('inquiry.received', $inquiry, context: ['type' => $inquiry->type->value]);

        return response()->json(
            ['message' => 'Thanks. We will get back to you.'],
            201,
        );
    }
}
