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

];
