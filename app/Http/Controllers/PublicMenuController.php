<?php

namespace App\Http\Controllers;

use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicMenuController extends Controller
{
    /**
     * The live menu: non-empty categories in order, each with its items and sizes.
     */
    public function __invoke(): AnonymousResourceCollection
    {
        $categories = Category::query()
            ->whereHas('menuItems')
            ->with('menuItems.sizes')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return CategoryResource::collection($categories);
    }
}
