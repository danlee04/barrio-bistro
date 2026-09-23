<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Preparing = 'preparing';
    case Ready = 'ready';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    /**
     * Human-readable status shown to the guest.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Waiting for payment',
            self::Confirmed => 'Confirmed',
            self::Preparing => 'Preparing',
            self::Ready => 'Ready',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * Whether the guest's screen should keep watching for changes.
     */
    public function isOpen(): bool
    {
        return ! in_array($this, [self::Completed, self::Cancelled], true);
    }

    /**
     * Where an order may go from here. `confirmed` appears only as the step
     * paying takes it to: no staff move ever produces it.
     *
     * @return list<self>
     */
    public function allowedNext(): array
    {
        return match ($this) {
            self::Pending => [self::Confirmed, self::Cancelled],
            self::Confirmed => [self::Preparing],
            self::Preparing => [self::Ready],
            self::Ready => [self::Completed],
            self::Completed, self::Cancelled => [],
        };
    }
}
