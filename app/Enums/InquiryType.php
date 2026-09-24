<?php

namespace App\Enums;

enum InquiryType: string
{
    case Bulk = 'bulk';
    case Contact = 'contact';

    /**
     * What staff see in the list.
     */
    public function label(): string
    {
        return match ($this) {
            self::Bulk => 'Bulk order',
            self::Contact => 'Message',
        };
    }

    /**
     * A bulk order asks for the date and the headcount; a message does not.
     */
    public function needsEventDetails(): bool
    {
        return $this === self::Bulk;
    }
}
