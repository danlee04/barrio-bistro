<?php

namespace App\Http\Resources;

use App\Models\Inquiry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Staff-only. Everything here is somebody's personal detail.
 *
 * @mixin Inquiry
 */
class InquiryResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'name' => $this->name,
            'contact' => $this->contact,
            'event_date' => $this->event_date?->toDateString(),
            'guests' => $this->guests,
            'message' => $this->message,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
