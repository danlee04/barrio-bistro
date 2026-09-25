<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateGalleryPhotoRequest extends FormRequest
{
    /**
     * The route group and the controller both hold this to admins already.
     * Saying it a third time here costs nothing and means no single edit
     * elsewhere can quietly open it up.
     */
    public function authorize(): bool
    {
        return $this->user()?->hasRole(Role::Admin) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'caption' => ['present', 'nullable', 'string', 'max:120'],
        ];
    }
}
