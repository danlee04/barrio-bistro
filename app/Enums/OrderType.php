<?php

namespace App\Enums;

enum OrderType: string
{
    case DineIn = 'dine_in';
    case Takeout = 'takeout';

    /**
     * Human-readable name shown to the guest and on the order screens.
     */
    public function label(): string
    {
        return match ($this) {
            self::DineIn => 'Dine in',
            self::Takeout => 'Take out',
        };
    }
}
