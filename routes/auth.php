<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\TwoFactorChallengeController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthenticatedSessionController::class, 'store'])
    ->middleware(['guest', 'throttle:login'])
    ->name('login');

// Six digits is a million guesses; without a throttle a machine walks it.
Route::post('/two-factor-challenge', TwoFactorChallengeController::class)
    ->middleware(['guest', 'throttle:two-factor'])
    ->name('two-factor.challenge');

Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])
    ->middleware('auth')
    ->name('logout');
