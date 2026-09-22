<?php

use Illuminate\Support\Facades\Route;

require __DIR__.'/auth.php';

Route::view('/{path?}', 'app')
    ->where('path', '(?!(api|sanctum|up)(/|$)).*')
    ->name('spa');
