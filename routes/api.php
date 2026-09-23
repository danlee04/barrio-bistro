<?php

use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\MarkOrderPaidController;
use App\Http\Controllers\Admin\MenuItemController;
use App\Http\Controllers\Admin\MenuItemPhotoController;
use App\Http\Controllers\Admin\StaffController;
use App\Http\Controllers\Admin\StaffPasswordController;
use App\Http\Controllers\CheckoutOptionsController;
use App\Http\Controllers\CurrentUserController;
use App\Http\Controllers\CurrentUserPasswordController;
use App\Http\Controllers\MenuItemAvailabilityController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\OrderPaymentController;
use App\Http\Controllers\PayMongoWebhookController;
use App\Http\Controllers\PublicMenuController;
use Illuminate\Support\Facades\Route;

Route::get('/menu', PublicMenuController::class)->name('menu.show');
Route::get('/checkout/options', CheckoutOptionsController::class)->name('checkout.options');

Route::post('/orders', [OrderController::class, 'store'])
    ->middleware('throttle:orders')
    ->name('orders.store');
Route::get('/orders/{order}', [OrderController::class, 'show'])->name('orders.show');

Route::post('/orders/{order}/checkout-session', [OrderPaymentController::class, 'session'])
    ->middleware('throttle:payments')
    ->name('orders.payment.session');
Route::post('/orders/{order}/payment/refresh', [OrderPaymentController::class, 'refresh'])
    ->middleware('throttle:payments')
    ->name('orders.payment.refresh');

Route::post('/webhooks/paymongo', PayMongoWebhookController::class)
    ->middleware('paymongo.signature')
    ->name('webhooks.paymongo');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/me', CurrentUserController::class)->name('me.show');
    Route::put('/me/password', CurrentUserPasswordController::class)
        ->middleware('throttle:6,1')
        ->name('me.password.update');

    Route::middleware('password.changed')->group(function () {
        Route::patch('/menu-items/{menuItem}/availability', MenuItemAvailabilityController::class)
            ->name('menu-items.availability.update');

        Route::post('/orders/{order}/mark-paid', MarkOrderPaidController::class)->name('orders.mark-paid');

        Route::prefix('admin')->name('admin.')->middleware('role:admin')->group(function () {
            Route::get('/staff', [StaffController::class, 'index'])->name('staff.index');
            Route::post('/staff', [StaffController::class, 'store'])->name('staff.store');
            Route::patch('/staff/{user}', [StaffController::class, 'update'])->name('staff.update');
            Route::put('/staff/{user}/password', StaffPasswordController::class)->name('staff.password.update');

            Route::get('/categories', [CategoryController::class, 'index'])->name('categories.index');
            Route::post('/categories', [CategoryController::class, 'store'])->name('categories.store');
            Route::patch('/categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
            Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');
            Route::post('/categories/{category}/restore', [CategoryController::class, 'restore'])->withTrashed()->name('categories.restore');
            Route::post('/categories/{category}/move', [CategoryController::class, 'move'])->name('categories.move');

            Route::get('/menu-items', [MenuItemController::class, 'index'])->name('menu-items.index');
            Route::post('/menu-items', [MenuItemController::class, 'store'])->name('menu-items.store');
            Route::get('/menu-items/{menuItem}', [MenuItemController::class, 'show'])->name('menu-items.show');
            Route::patch('/menu-items/{menuItem}', [MenuItemController::class, 'update'])->name('menu-items.update');
            Route::delete('/menu-items/{menuItem}', [MenuItemController::class, 'destroy'])->name('menu-items.destroy');
            Route::post('/menu-items/{menuItem}/restore', [MenuItemController::class, 'restore'])->withTrashed()->name('menu-items.restore');
            Route::post('/menu-items/{menuItem}/move', [MenuItemController::class, 'move'])->name('menu-items.move');
            Route::post('/menu-items/{menuItem}/photo', [MenuItemPhotoController::class, 'store'])->name('menu-items.photo.store');
            Route::delete('/menu-items/{menuItem}/photo', [MenuItemPhotoController::class, 'destroy'])->name('menu-items.photo.destroy');
        });
    });
});
