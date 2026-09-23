<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Dining Tables
    |--------------------------------------------------------------------------
    |
    | The highest table number a guest may order from. Table numbers arrive in
    | the QR code on each table, so this is the guard against a typed or
    | tampered number pointing at a table that does not exist.
    |
    */

    'tables' => (int) env('RESTAURANT_TABLES', 20),

    /*
    |--------------------------------------------------------------------------
    | Business Day
    |--------------------------------------------------------------------------
    |
    | Order numbers restart at 1 every business day, counted in the restaurant's
    | own timezone rather than the server's.
    |
    */

    'timezone' => (string) env('RESTAURANT_TIMEZONE', 'Asia/Manila'),

    /*
    |--------------------------------------------------------------------------
    | Order Number Prefix
    |--------------------------------------------------------------------------
    |
    | Order numbers read BB-20260923-0031: prefix, business date, daily number.
    |
    */

    'order_prefix' => (string) env('RESTAURANT_ORDER_PREFIX', 'BB'),

];
