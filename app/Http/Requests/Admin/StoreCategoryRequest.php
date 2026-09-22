<?php

namespace App\Http\Requests\Admin;

use App\Models\Category;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreCategoryRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', Category::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:60', Rule::unique(Category::class, 'name')],
            'description' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * The name must make a usable slug that no category (archived ones included) already has.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $name = $this->input('name');

                if (! is_string($name) || $validator->errors()->has('name')) {
                    return;
                }

                $slug = Str::slug($name);

                if ($slug === '') {
                    $validator->errors()->add('name', 'The name must contain letters or numbers.');
                } elseif (Category::withTrashed()->where('slug', $slug)->exists()) {
                    $validator->errors()->add('name', 'A category with a very similar name already exists (it may be archived).');
                }
            },
        ];
    }
}
