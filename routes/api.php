<?php

use App\Http\Controllers\Admin\StaffController;
use App\Http\Controllers\CurrentUserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/me', CurrentUserController::class)->name('me.show');

    Route::prefix('admin')->name('admin.')->middleware('role:admin')->group(function () {
        Route::get('/staff', [StaffController::class, 'index'])->name('staff.index');
    });
});
