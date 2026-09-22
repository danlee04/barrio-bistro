<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMenuItemRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', MenuItem::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', Rule::exists(Category::class, 'id')->withoutTrashed()],
            'name' => ['required', 'string', 'max:80', Rule::unique(MenuItem::class, 'name')],
            'description' => ['nullable', 'string', 'max:500'],
            'is_featured' => ['sometimes', 'boolean'],
            'sizes' => ['required', 'array', 'min:1', 'max:6'],
            'sizes.*.name' => ['required', 'string', 'max:40', 'distinct:ignore_case'],
            'sizes.*.price' => ['required', 'integer', 'min:1', 'max:10000000'],
        ];
    }
}
