<?php

namespace App\Enums;

/**
 * One payment attempt's own state. The order's overall standing is
 * `PaymentStatus`: an order with three failed attempts and one paid one is
 * simply paid.
 */
enum PaymentState: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Failed = 'failed';
}
