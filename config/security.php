<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Content Security Policy Report-Only Mode
    |--------------------------------------------------------------------------
    |
    | When true, the CSP is sent as "Content-Security-Policy-Report-Only": the
    | browser logs violations but blocks nothing. Use it only while rolling
    | out a policy change, then switch back to enforcing mode.
    |
    */

    'csp_report_only' => (bool) env('CSP_REPORT_ONLY', false),

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | Addresses or CIDR ranges of the load balancers and CDNs that sit in front
    | of this app, comma separated; "*" trusts whatever forwarded them, which
    | is only safe when nothing can reach the app except through the proxy.
    |
    | This matters more than it looks: without it every rate limiter — login,
    | orders, payments, enquiries — sees the proxy's address instead of the
    | visitor's and collapses into a single bucket that one attacker can empty
    | for everybody. HSTS is also never sent, because the request looks plain.
    |
    | Empty is correct on a machine with no proxy in front of it.
    |
    */

    'trusted_proxies' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('TRUSTED_PROXIES', '')),
    ))),

    /*
    |--------------------------------------------------------------------------
    | Enquiry Retention
    |--------------------------------------------------------------------------
    |
    | How many days a message from the website is kept before it is deleted.
    | Every enquiry holds somebody's name and their email or mobile number,
    | and the Data Privacy Act asks that personal data is not kept for longer
    | than it is needed. A year covers a party booked one Christmas and asked
    | about again the next.
    |
    | Pruning runs from the scheduler, so it needs `schedule:run` on a cron.
    |
    */

    'inquiry_retention_days' => (int) env('INQUIRY_RETENTION_DAYS', 365),

];
