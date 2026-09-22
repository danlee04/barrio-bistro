<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateStaffRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $staff = $this->route('user');

        return $staff instanceof User && ($this->user()?->can('update', $staff) ?? false);
    }

    /**
     * Normalize the email so the same address can't be added twice with different casing.
     */
    protected function prepareForValidation(): void
    {
        $email = $this->input('email');

        if (is_string($email)) {
            $this->merge(['email' => Str::lower(trim($email))]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique(User::class, 'email')->ignore($this->route('user'))],
            'role' => ['sometimes', 'required', Rule::enum(Role::class)],
            'is_active' => ['sometimes', 'required', 'boolean'],
        ];
    }

    /**
     * An admin can never remove their own access, so at least one active admin always remains.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $staff = $this->route('user');

                if (! $staff instanceof User || $staff->isNot($this->user())) {
                    return;
                }

                if ($this->has('role') && $this->enum('role', Role::class) !== Role::Admin) {
                    $validator->errors()->add('role', 'You cannot remove your own admin role.');
                }

                if ($this->has('is_active') && ! $this->boolean('is_active')) {
                    $validator->errors()->add('is_active', 'You cannot deactivate your own account.');
                }
            },
        ];
    }
}
