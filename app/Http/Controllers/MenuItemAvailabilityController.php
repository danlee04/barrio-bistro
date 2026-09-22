<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateMenuItemAvailabilityRequest;
use App\Http\Resources\MenuItemResource;
use App\Models\AuditLog;
use App\Models\MenuItem;

class MenuItemAvailabilityController extends Controller
{
    /**
     * Mark an item sold out ("Ubos na") or available again.
     */
    public function __invoke(UpdateMenuItemAvailabilityRequest $request, MenuItem $menuItem): MenuItemResource
    {
        $menuItem->is_available = $request->boolean('is_available');
        $menuItem->save();

        if ($menuItem->wasChanged('is_available')) {
            AuditLog::record('menu_item.availability_changed', $menuItem, context: ['is_available' => $menuItem->is_available]);
        }

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }
}
