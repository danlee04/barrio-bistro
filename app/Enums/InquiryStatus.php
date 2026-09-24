<?php

namespace App\Enums;

enum InquiryStatus: string
{
    case New = 'new';
    case Read = 'read';
    case Closed = 'closed';

    /**
     * What staff see on the badge.
     */
    public function label(): string
    {
        return match ($this) {
            self::New => 'New',
            self::Read => 'Read',
            self::Closed => 'Closed',
        };
    }
}
