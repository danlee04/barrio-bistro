<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\MenuItemSize;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMenuItemRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $menuItem = $this->route('menuItem');

        return $menuItem instanceof MenuItem && ($this->user()?->can('update', $menuItem) ?? false);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $menuItem = $this->route('menuItem');
        $menuItemId = $menuItem instanceof MenuItem ? $menuItem->id : 0;

        return [
            'category_id' => ['sometimes', 'required', 'integer', Rule::exists(Category::class, 'id')->withoutTrashed()],
            'name' => ['sometimes', 'required', 'string', 'max:80', Rule::unique(MenuItem::class, 'name')->ignore($menuItemId)],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'is_featured' => ['sometimes', 'boolean'],
            'sizes' => ['sometimes', 'required', 'array', 'min:1', 'max:6'],
            'sizes.*.id' => ['nullable', 'integer', 'distinct', Rule::exists(MenuItemSize::class, 'id')->where('menu_item_id', $menuItemId)],
            'sizes.*.name' => ['required', 'string', 'max:40', 'distinct:ignore_case'],
            'sizes.*.price' => ['required', 'integer', 'min:1', 'max:10000000'],
        ];
    }
}
