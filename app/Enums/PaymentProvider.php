<?php

namespace App\Enums;

enum PaymentProvider: string
{
    case PayMongo = 'paymongo';
    case Counter = 'counter';
}
