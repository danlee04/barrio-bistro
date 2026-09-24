<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreGalleryPhotoRequest extends FormRequest
{
    /**
     * The route group already keeps this to admins.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
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
            'caption' => ['nullable', 'string', 'max:120'],
        ];
    }
}
