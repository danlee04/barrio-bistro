<?php

use App\Models\Inquiry;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Messages from the website hold somebody's name and their number, so they are
 * deleted once they are past being useful. Quiet hours, once a day.
 */
Schedule::command('model:prune', ['--model' => [Inquiry::class]])
    ->dailyAt('03:30')
    ->timezone(config('restaurant.timezone'))
    ->onOneServer();
