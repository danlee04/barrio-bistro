<?php

namespace App\Http\Requests\Admin;

use App\Models\MenuItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMenuItemPhotoRequest extends FormRequest
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
     * Content is sniffed (mimetypes), and the pixel size is read from the header
     * before anything is decoded, so decompression bombs never reach GD.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'photo' => [
                'required',
                'file',
                'max:5120',
                'mimetypes:image/jpeg,image/png,image/webp',
                'extensions:jpg,jpeg,png,webp',
                'dimensions:min_width=800,min_height=800,max_width=4096,max_height=4096',
            ],
        ];
    }
}
