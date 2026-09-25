<?php

use App\Http\Controllers\Admin\GalleryController;
use App\Http\Controllers\Admin\InquiryController;
use App\Http\Controllers\Admin\ReportsController;
use App\Models\User;
use Illuminate\Support\Facades\Route;

/**
 * The admin route group is one edit away from being wrong. These screens say
 * "admins only" on the controller too, so a route registered anywhere else
 * still refuses everybody but an admin. The paths start with "api" only
 * because the SPA catch-all in web.php claims everything else.
 */
beforeEach(function () {
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/api/loose/reports', ReportsController::class);
        Route::get('/api/loose/inquiries', [InquiryController::class, 'index']);
        Route::get('/api/loose/gallery', [GalleryController::class, 'index']);
    });
});

$paths = ['/api/loose/reports', '/api/loose/inquiries', '/api/loose/gallery'];

test('a route outside the admin group still turns staff away', function () use ($paths) {
    foreach (['cashier', 'kitchen'] as $role) {
        $staff = User::factory()->{$role}()->create();

        foreach ($paths as $path) {
            $this->actingAs($staff)->getJson($path)->assertForbidden();
        }
    }
});

test('a route outside the admin group still turns a stranger away', function () use ($paths) {
    foreach ($paths as $path) {
        $this->getJson($path)->assertUnauthorized();
    }
});

test('an admin is still let through', function () use ($paths) {
    $admin = User::factory()->admin()->create();

    foreach ($paths as $path) {
        $this->actingAs($admin)->getJson($path)->assertOk();
    }
});
