<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Auth;

/**
 * Append-only record of who did what, to which record, and from where.
 *
 * @property int $id
 * @property string $action
 * @property string|null $subject_type
 * @property int|null $subject_id
 * @property int|null $causer_id
 * @property array<string, mixed>|null $context
 * @property array<string, mixed>|null $changes
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property CarbonImmutable $created_at
 */
#[Fillable(['action', 'subject_type', 'subject_id', 'causer_id', 'context', 'changes', 'ip_address', 'user_agent'])]
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    /**
     * Keys whose values must never reach the audit trail.
     *
     * @var list<string>
     */
    private const REDACTED_KEYS = ['password', 'password_confirmation', 'current_password', 'remember_token', 'token'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'context' => 'array',
            'changes' => 'array',
            'created_at' => 'immutable_datetime',
        ];
    }

    /**
     * Record a security-relevant event; the causer defaults to the signed-in user.
     *
     * @param  array<string, mixed>  $context
     * @param  array<string, mixed>  $changes
     */
    public static function record(string $action, ?Model $subject = null, ?User $causer = null, array $context = [], array $changes = []): self
    {
        $request = request();
        $userAgent = $request->userAgent();

        return self::query()->create([
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'causer_id' => ($causer ?? Auth::user())?->getAuthIdentifier(),
            'context' => $context === [] ? null : self::redact($context),
            'changes' => $changes === [] ? null : self::redact($changes),
            'ip_address' => $request->ip(),
            'user_agent' => $userAgent === null ? null : mb_substr($userAgent, 0, 512),
        ]);
    }

    /**
     * Record an update as a before/after diff of the attributes changed by the last save.
     */
    public static function recordChange(string $action, Model $subject, ?User $causer = null): self
    {
        $previous = $subject->getPrevious();
        $changes = [];

        foreach ($subject->getChanges() as $attribute => $newValue) {
            if ($attribute === $subject->getUpdatedAtColumn()) {
                continue;
            }

            $changes[$attribute] = ['from' => $previous[$attribute] ?? null, 'to' => $newValue];
        }

        return self::record($action, $subject, $causer, changes: $changes);
    }

    /**
     * Replace sensitive values at any depth.
     *
     * @param  array<array-key, mixed>  $data
     * @return array<array-key, mixed>
     */
    private static function redact(array $data): array
    {
        foreach ($data as $key => $value) {
            if (in_array(mb_strtolower((string) $key), self::REDACTED_KEYS, true)) {
                $data[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $data[$key] = self::redact($value);
            }
        }

        return $data;
    }

    /**
     * The staff member who performed the action.
     *
     * @return BelongsTo<User, $this>
     */
    public function causer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'causer_id');
    }

    /**
     * The record the action was performed on.
     *
     * @return MorphTo<Model, $this>
     */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
