<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case Counter = 'counter';
    case Online = 'online';

    /**
     * Human-readable method shown at checkout.
     */
    public function label(): string
    {
        return match ($this) {
            self::Counter => 'Pay at the counter',
            self::Online => 'Pay online (GCash or card)',
        };
    }
}
