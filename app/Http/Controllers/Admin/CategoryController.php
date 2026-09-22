<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListCategoriesRequest;
use App\Http\Requests\Admin\MoveRequest;
use App\Http\Requests\Admin\StoreCategoryRequest;
use App\Http\Requests\Admin\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\AuditLog;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class CategoryController extends Controller
{
    /**
     * Active (or archived) categories in display order, with how many items each has.
     */
    public function index(ListCategoriesRequest $request): AnonymousResourceCollection
    {
        $query = Category::query()->withCount('menuItems')->orderBy('sort_order')->orderBy('name');

        if ($request->boolean('archived')) {
            $query->onlyTrashed();
        }

        return CategoryResource::collection($query->get());
    }

    /**
     * Add a category at the end of the list.
     */
    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = new Category($request->validated());
        $category->sort_order = $category->nextSortOrder();
        $category->save();

        AuditLog::record('category.created', $category);

        return CategoryResource::make($category)->response()->setStatusCode(201);
    }

    /**
     * Rename or describe a category.
     */
    public function update(UpdateCategoryRequest $request, Category $category): CategoryResource
    {
        $category->fill($request->validated());
        $category->save();

        if ($category->wasChanged()) {
            AuditLog::recordChange('category.updated', $category);
        }

        return CategoryResource::make($category);
    }

    /**
     * Archive a category; its items disappear from the menu with it.
     */
    public function destroy(Category $category): Response
    {
        Gate::authorize('delete', $category);

        $category->delete();
        AuditLog::record('category.archived', $category);

        return response()->noContent();
    }

    /**
     * Bring an archived category back.
     */
    public function restore(Category $category): CategoryResource
    {
        Gate::authorize('restore', $category);

        $category->restore();
        AuditLog::record('category.restored', $category);

        return CategoryResource::make($category);
    }

    /**
     * Move a category one place up or down.
     */
    public function move(MoveRequest $request, Category $category): Response
    {
        Gate::authorize('update', $category);

        $category->moveInSortOrder($request->string('direction')->toString());

        return response()->noContent();
    }
}
