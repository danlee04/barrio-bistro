<?php

namespace App\Http\Resources;

use App\Models\MenuItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin MenuItem
 */
class MenuItemResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category_name' => $this->whenLoaded('category', fn (): string => $this->category->name),
            'name' => $this->name,
            'description' => $this->description,
            'image' => $this->imageUrls(),
            'is_available' => $this->is_available,
            'is_featured' => $this->is_featured,
            'sort_order' => $this->sort_order,
            'archived_at' => $this->deleted_at?->toIso8601String(),
            'sizes' => MenuItemSizeResource::collection($this->whenLoaded('sizes')),
        ];
    }
}
