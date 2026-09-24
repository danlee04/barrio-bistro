<?php

namespace App\Http\Requests\Admin;

use App\Enums\InquiryStatus;
use App\Enums\InquiryType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListInquiriesRequest extends FormRequest
{
    /**
     * The route group already keeps this to admins.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::enum(InquiryStatus::class)],
            'type' => ['nullable', Rule::enum(InquiryType::class)],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
