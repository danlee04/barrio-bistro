<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateMenuItemPhotoRequest;
use App\Http\Resources\MenuItemResource;
use App\Models\AuditLog;
use App\Models\MenuItem;
use App\Services\MenuPhotoProcessor;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Throwable;

class MenuItemPhotoController extends Controller
{
    public function __construct(private readonly MenuPhotoProcessor $photos) {}

    /**
     * Replace an item's photo with freshly processed renditions.
     */
    public function store(UpdateMenuItemPhotoRequest $request, MenuItem $menuItem): MenuItemResource
    {
        $photo = $request->file('photo');

        if (! $photo instanceof UploadedFile) {
            abort(422, 'A photo is required.');
        }

        $newPath = $this->photos->store($photo);
        $oldPath = $menuItem->image_path;

        try {
            $menuItem->forceFill(['image_path' => $newPath])->save();
        } catch (Throwable $exception) {
            $this->photos->delete($newPath);

            throw $exception;
        }

        if ($oldPath !== null) {
            $this->photos->delete($oldPath);
        }

        AuditLog::record('menu_item.photo_changed', $menuItem);

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }

    /**
     * Remove an item's photo.
     */
    public function destroy(MenuItem $menuItem): MenuItemResource
    {
        Gate::authorize('update', $menuItem);

        if ($menuItem->image_path !== null) {
            $this->photos->delete($menuItem->image_path);
            $menuItem->forceFill(['image_path' => null])->save();

            AuditLog::record('menu_item.photo_removed', $menuItem);
        }

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }
}
