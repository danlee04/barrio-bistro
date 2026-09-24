<?php

namespace App\Models;

use App\Enums\InquiryStatus;
use App\Enums\InquiryType;
use Carbon\CarbonImmutable;
use Database\Factories\InquiryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A message left on the website: a bulk-order enquiry, or an ordinary one.
 *
 * Everything here is somebody's personal detail, so it is never exposed
 * publicly, never written to a log, and only staff may read it.
 *
 * `status` is missing from the fillable list on purpose: only a staff action
 * moves it, never the public form.
 *
 * @property int $id
 * @property InquiryType $type
 * @property string $name
 * @property string $contact
 * @property CarbonImmutable|null $event_date
 * @property int|null $guests
 * @property string $message
 * @property InquiryStatus $status
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['type', 'name', 'contact', 'event_date', 'guests', 'message'])]
class Inquiry extends Model
{
    /** @use HasFactory<InquiryFactory> */
    use HasFactory;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => InquiryStatus::New->value,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => InquiryType::class,
            'status' => InquiryStatus::class,
            'event_date' => 'immutable_date',
            'guests' => 'integer',
        ];
    }
}
