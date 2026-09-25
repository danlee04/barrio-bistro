<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class TwoFactorChallengeRequest extends FormRequest
{
    /**
     * Whoever holds the half-finished session may try; the code decides.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Spaces and dashes are stripped: authenticator apps show "123 456", and
     * anyone copying it brings the space along.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'code' => preg_replace('/\s|-/', '', (string) $this->input('code', '')) ?: null,
            'recovery_code' => trim((string) $this->input('recovery_code', '')) ?: null,
        ]);
    }

    /**
     * One or the other, never both.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'code' => ['required_without:recovery_code', 'nullable', 'string', 'digits:6'],
            'recovery_code' => ['required_without:code', 'nullable', 'string', 'max:64'],
        ];
    }

    /**
     * Get the error messages for the defined validation rules.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.required_without' => 'Enter the six digits from your authenticator.',
            'code.digits' => 'That code is six digits.',
            'recovery_code.required_without' => 'Enter a recovery code.',
        ];
    }
}
