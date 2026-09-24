<?php

namespace App\Http\Controllers;

use App\Http\Resources\GalleryPhotoResource;
use App\Models\GalleryPhoto;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicGalleryController extends Controller
{
    /**
     * The gallery as the shop arranged it.
     */
    public function __invoke(): AnonymousResourceCollection
    {
        return GalleryPhotoResource::collection(
            GalleryPhoto::query()->orderBy('sort_order')->orderBy('id')->get(),
        );
    }
}
