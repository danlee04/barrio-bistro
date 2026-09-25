<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MoveRequest;
use App\Http\Requests\Admin\StoreGalleryPhotoRequest;
use App\Http\Requests\Admin\UpdateGalleryPhotoRequest;
use App\Http\Resources\GalleryPhotoResource;
use App\Models\AuditLog;
use App\Models\GalleryPhoto;
use App\Services\PhotoProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Throwable;

class GalleryController extends Controller implements HasMiddleware
{
    /**
     * @return list<Middleware>
     */
    public static function middleware(): array
    {
        return [new Middleware('role:admin')];
    }

    public function __construct(private readonly PhotoProcessor $photos) {}

    /**
     * Every photo, in the order the website shows them.
     */
    public function index(): AnonymousResourceCollection
    {
        return GalleryPhotoResource::collection(
            GalleryPhoto::query()->orderBy('sort_order')->orderBy('id')->get(),
        );
    }

    /**
     * Add a photo to the end of the gallery.
     */
    public function store(StoreGalleryPhotoRequest $request): JsonResponse
    {
        $upload = $request->file('photo');

        if (! $upload instanceof UploadedFile) {
            abort(422, 'A photo is required.');
        }

        $path = $this->photos->store($upload, 'gallery');

        try {
            $photo = new GalleryPhoto(['caption' => $request->validated('caption')]);
            $photo->path = $path;
            $photo->sort_order = $photo->nextSortOrder();
            $photo->save();
        } catch (Throwable $exception) {
            $this->photos->delete($path);

            throw $exception;
        }

        AuditLog::record('gallery.added', $photo);

        return GalleryPhotoResource::make($photo)->response()->setStatusCode(201);
    }

    /**
     * Change what a photo says.
     */
    public function update(UpdateGalleryPhotoRequest $request, GalleryPhoto $galleryPhoto): GalleryPhotoResource
    {
        $galleryPhoto->update(['caption' => $request->validated('caption')]);

        AuditLog::recordChange('gallery.updated', $galleryPhoto);

        return GalleryPhotoResource::make($galleryPhoto);
    }

    /**
     * Take a photo off the website, files and all.
     */
    public function destroy(GalleryPhoto $galleryPhoto): Response
    {
        $path = $galleryPhoto->path;

        $galleryPhoto->delete();
        $this->photos->delete($path);

        AuditLog::record('gallery.removed', context: ['path' => $path]);

        return response()->noContent();
    }

    /**
     * Move a photo one place up or down the gallery.
     */
    public function move(MoveRequest $request, GalleryPhoto $galleryPhoto): Response
    {
        $galleryPhoto->moveInSortOrder((string) $request->validated('direction'));

        return response()->noContent();
    }
}
