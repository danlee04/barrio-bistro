<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => ['app' => config('app.name')])->name('home');
