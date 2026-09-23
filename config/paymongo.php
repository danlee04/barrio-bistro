<?php

return [

    /*
    |--------------------------------------------------------------------------
    | API Keys
    |--------------------------------------------------------------------------
    |
    | The secret key talks to PayMongo; the webhook secret proves an incoming
    | event came from them. With no secret key, online payment is switched off
    | everywhere and the app simply offers paying at the counter.
    |
    */

    'secret_key' => (string) env('PAYMONGO_SECRET_KEY', ''),

    'webhook_secret' => (string) env('PAYMONGO_WEBHOOK_SECRET', ''),

    'base_url' => (string) env('PAYMONGO_BASE_URL', 'https://api.paymongo.com/v1'),

    /*
    |--------------------------------------------------------------------------
    | Payment Methods
    |--------------------------------------------------------------------------
    |
    | The methods offered on PayMongo's hosted page. Each one must also be
    | switched on in the PayMongo dashboard.
    |
    */

    'methods' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('PAYMONGO_METHODS', 'gcash,card')),
    ))),

    /*
    |--------------------------------------------------------------------------
    | Online Minimum
    |--------------------------------------------------------------------------
    |
    | Smallest order, in centavos, that may be paid online. PayMongo's API floor
    | is PHP 1.00, but e-wallets in practice want PHP 100.00, so that is the
    | default here. Anything smaller is paid at the counter.
    |
    */

    'minimum_amount' => (int) env('PAYMONGO_MINIMUM_AMOUNT', 10000),

    /*
    |--------------------------------------------------------------------------
    | Signature Tolerance
    |--------------------------------------------------------------------------
    |
    | How many seconds old a signed webhook may be before it is treated as a
    | replay.
    |
    */

    'signature_tolerance' => (int) env('PAYMONGO_SIGNATURE_TOLERANCE', 300),

];
