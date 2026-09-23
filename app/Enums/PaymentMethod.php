<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case Counter = 'counter';

    /**
     * Human-readable method shown at checkout.
     */
    public function label(): string
    {
        return match ($this) {
            self::Counter => 'Pay at the counter',
        };
    }
}
