<?php

namespace App\Http\Controllers\Admin;

use App\Enums\InquiryStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListInquiriesRequest;
use App\Http\Requests\Admin\UpdateInquiryStatusRequest;
use App\Http\Resources\InquiryResource;
use App\Models\AuditLog;
use App\Models\Inquiry;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class InquiryController extends Controller
{
    /**
     * The message book, newest first, optionally narrowed to one status or kind.
     */
    public function index(ListInquiriesRequest $request): AnonymousResourceCollection
    {
        $query = Inquiry::query()->latest('id');

        if ($request->filled('status')) {
            $query->where('status', $request->enum('status', InquiryStatus::class));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->string('type')->toString());
        }

        return InquiryResource::collection(
            $query->paginate($request->integer('per_page', 20))->withQueryString(),
        );
    }

    /**
     * Mark a message read or closed. Who did it, and when, lands in the audit trail.
     */
    public function update(UpdateInquiryStatusRequest $request, Inquiry $inquiry): InquiryResource
    {
        $inquiry->status = $request->enum('status', InquiryStatus::class);
        $inquiry->save();

        AuditLog::recordChange('inquiry.status_changed', $inquiry);

        return InquiryResource::make($inquiry);
    }
}
