<?php

namespace App\Enums;

enum Role: string
{
    case Admin = 'admin';
    case Cashier = 'cashier';
    case Kitchen = 'kitchen';

    /**
     * Human-readable name shown in the admin UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Admin',
            self::Cashier => 'Cashier',
            self::Kitchen => 'Kitchen',
        };
    }
}
