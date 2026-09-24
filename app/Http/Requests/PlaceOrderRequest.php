<?php

namespace App\Http\Requests;

use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Services\PayMongoClient;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PlaceOrderRequest extends FormRequest
{
    /**
     * Anyone in the restaurant may order; guests never sign in.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * A take-out order has no table; a dine-in order may carry either a table
     * or a name, because one guest is seated and another is at the counter.
     */
    protected function prepareForValidation(): void
    {
        $name = trim((string) $this->input('customer_name', ''));

        $this->merge([
            'table_number' => $this->isTakeout() ? null : $this->input('table_number'),
            'customer_name' => $name === '' ? null : $name,
        ]);
    }

    private function isDineIn(): bool
    {
        return $this->input('type') === OrderType::DineIn->value;
    }

    private function isTakeout(): bool
    {
        return $this->input('type') === OrderType::Takeout->value;
    }

    private function hasTable(): bool
    {
        return $this->filled('table_number');
    }

    private function hasName(): bool
    {
        return trim((string) $this->input('customer_name')) !== '';
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::enum(OrderType::class)],
            'table_number' => [
                Rule::requiredIf(fn (): bool => $this->isDineIn() && ! $this->hasName()),
                'nullable',
                'integer',
                'min:1',
                'max:'.(int) config('restaurant.tables'),
            ],
            'customer_name' => [
                Rule::requiredIf(fn (): bool => $this->isTakeout()
                    || ($this->isDineIn() && ! $this->hasTable())),
                'nullable',
                'string',
                'max:40',
            ],
            'payment_method' => ['required', Rule::enum(PaymentMethod::class)->only($this->allowedMethods())],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*.menu_item_id' => ['required', 'integer', 'min:1'],
            'items.*.menu_item_size_id' => ['required', 'integer', 'min:1'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:20'],
            'items.*.note' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * Online payment is only offered while PayMongo is configured.
     *
     * @return array<int, PaymentMethod>
     */
    private function allowedMethods(): array
    {
        $methods = [PaymentMethod::Counter];

        if (app(PayMongoClient::class)->enabled()) {
            $methods[] = PaymentMethod::Online;
        }

        return $methods;
    }

    /**
     * Get the error messages for the defined validation rules.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'table_number.required' => 'Tell us the table, or leave a name.',
            'table_number.max' => 'We do not have a table with that number.',
            'customer_name.required' => 'Leave a name so we can call you.',
            'items.required' => 'Your order is empty.',
            'items.min' => 'Your order is empty.',
            'items.max' => 'That is too many dishes for one order. Please split it.',
        ];
    }
}
