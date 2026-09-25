<?php

namespace App\Models;

use App\Enums\InquiryStatus;
use App\Enums\InquiryType;
use Carbon\CarbonImmutable;
use Database\Factories\InquiryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
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
    use HasFactory, Prunable;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => InquiryStatus::New->value,
    ];

    /**
     * Messages older than the retention period are deleted, whatever their
     * status: nobody is coming back to a year-old enquiry, and keeping a
     * stranger's number past its usefulness is not ours to do.
     *
     * @return Builder<static>
     */
    public function prunable(): Builder
    {
        return static::query()->where(
            'created_at',
            '<',
            now()->subDays((int) config('security.inquiry_retention_days')),
        );
    }

    /**
     * Note that it went, without writing down what it said.
     */
    protected function pruning(): void
    {
        AuditLog::record('inquiry.pruned', context: [
            'id' => $this->id,
            'type' => $this->type->value,
        ]);
    }

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
