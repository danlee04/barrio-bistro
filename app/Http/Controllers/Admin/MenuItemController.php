<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListMenuItemsRequest;
use App\Http\Requests\Admin\MoveRequest;
use App\Http\Requests\Admin\StoreMenuItemRequest;
use App\Http\Requests\Admin\UpdateMenuItemRequest;
use App\Http\Resources\MenuItemResource;
use App\Models\AuditLog;
use App\Models\MenuItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class MenuItemController extends Controller
{
    /**
     * Items for the admin, optionally archived, filtered by category or searched by name.
     */
    public function index(ListMenuItemsRequest $request): AnonymousResourceCollection
    {
        $query = MenuItem::query()
            ->with(['category', 'sizes'])
            ->orderBy('category_id')
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($request->boolean('archived')) {
            $query->onlyTrashed();
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }

        $search = $request->string('search')->trim()->toString();

        if ($search !== '') {
            $query->whereLike('name', "%{$search}%");
        }

        return MenuItemResource::collection(
            $query->paginate($request->integer('per_page', 50))->withQueryString(),
        );
    }

    /**
     * One item, for the edit form.
     */
    public function show(MenuItem $menuItem): MenuItemResource
    {
        Gate::authorize('view', $menuItem);

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }

    /**
     * Add an item (available by default) at the end of its category.
     */
    public function store(StoreMenuItemRequest $request): JsonResponse
    {
        $menuItem = DB::transaction(function () use ($request): MenuItem {
            $menuItem = new MenuItem($request->safe()->only(['category_id', 'name', 'description', 'is_featured']));
            $menuItem->sort_order = $menuItem->nextSortOrder();
            $menuItem->save();

            $menuItem->syncSizes($request->validated('sizes'));

            AuditLog::record('menu_item.created', $menuItem, context: ['sizes' => $menuItem->priceList()]);

            return $menuItem;
        });

        return MenuItemResource::make($menuItem->load(['category', 'sizes']))->response()->setStatusCode(201);
    }

    /**
     * Change an item's details and sizes; price changes are audited with before and after.
     */
    public function update(UpdateMenuItemRequest $request, MenuItem $menuItem): MenuItemResource
    {
        DB::transaction(function () use ($request, $menuItem): void {
            $pricesBefore = $menuItem->priceList();

            $menuItem->fill($request->safe()->only(['category_id', 'name', 'description', 'is_featured']));

            if ($menuItem->isDirty('category_id')) {
                $menuItem->sort_order = $menuItem->nextSortOrder();
            }

            $menuItem->save();

            if ($request->has('sizes')) {
                $menuItem->syncSizes($request->validated('sizes'));
            }

            $pricesAfter = $menuItem->priceList();
            $priceChanges = $pricesBefore === $pricesAfter
                ? []
                : ['sizes' => ['from' => $pricesBefore, 'to' => $pricesAfter]];

            if ($menuItem->wasChanged() || $priceChanges !== []) {
                AuditLog::recordChange('menu_item.updated', $menuItem, extraChanges: $priceChanges);
            }
        });

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }

    /**
     * Archive an item; it leaves the menu but stays in order history.
     */
    public function destroy(MenuItem $menuItem): Response
    {
        Gate::authorize('delete', $menuItem);

        $menuItem->delete();
        AuditLog::record('menu_item.archived', $menuItem);

        return response()->noContent();
    }

    /**
     * Bring an archived item back.
     */
    public function restore(MenuItem $menuItem): MenuItemResource
    {
        Gate::authorize('restore', $menuItem);

        $menuItem->restore();
        AuditLog::record('menu_item.restored', $menuItem);

        return MenuItemResource::make($menuItem->load(['category', 'sizes']));
    }

    /**
     * Move an item one place up or down within its category.
     */
    public function move(MoveRequest $request, MenuItem $menuItem): Response
    {
        Gate::authorize('update', $menuItem);

        $menuItem->moveInSortOrder($request->string('direction')->toString());

        return response()->noContent();
    }
}
