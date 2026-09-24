<?php

namespace App\Http\Requests;

use App\Enums\InquiryType;
use App\Rules\EmailOrPhone;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInquiryRequest extends FormRequest
{
    /**
     * Anyone may write to the shop; the throttle and the honeypot hold the rest.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Trim the free text before it is measured, so spaces cannot pad a field
     * past its limit or stand in for an answer.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) $this->input('name', '')),
            'contact' => trim((string) $this->input('contact', '')),
            'message' => trim((string) $this->input('message', '')),
        ]);
    }

    private function isBulk(): bool
    {
        return $this->input('type') === InquiryType::Bulk->value;
    }

    /**
     * Every field is bounded, and `website` is the honeypot: a real person
     * never sees it, so anything that fills it is not a person.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::enum(InquiryType::class)],
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'contact' => ['required', 'string', 'max:120', new EmailOrPhone],
            'event_date' => [
                Rule::requiredIf(fn (): bool => $this->isBulk()),
                'nullable',
                'date_format:Y-m-d',
                'after_or_equal:today',
                'before:+1 year',
            ],
            'guests' => [
                Rule::requiredIf(fn (): bool => $this->isBulk()),
                'nullable',
                'integer',
                'min:1',
                'max:1000',
            ],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
            'website' => ['prohibited'],
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
            'name.required' => 'Tell us who you are.',
            'event_date.required' => 'Which day is it for?',
            'event_date.after_or_equal' => 'Pick a day that has not passed.',
            'event_date.before' => 'That is too far ahead. Call us instead.',
            'guests.required' => 'Roughly how many people are eating?',
            'message.required' => 'Tell us what you need.',
            'message.min' => 'A little more detail, please.',
        ];
    }
}
