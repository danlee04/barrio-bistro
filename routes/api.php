<?php

use App\Http\Controllers\Admin\StaffController;
use App\Http\Controllers\Admin\StaffPasswordController;
use App\Http\Controllers\CurrentUserController;
use App\Http\Controllers\CurrentUserPasswordController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/me', CurrentUserController::class)->name('me.show');
    Route::put('/me/password', CurrentUserPasswordController::class)
        ->middleware('throttle:6,1')
        ->name('me.password.update');

    Route::middleware('password.changed')->group(function () {
        Route::prefix('admin')->name('admin.')->middleware('role:admin')->group(function () {
            Route::get('/staff', [StaffController::class, 'index'])->name('staff.index');
            Route::post('/staff', [StaffController::class, 'store'])->name('staff.store');
            Route::patch('/staff/{user}', [StaffController::class, 'update'])->name('staff.update');
            Route::put('/staff/{user}/password', StaffPasswordController::class)->name('staff.password.update');
        });
    });
});
