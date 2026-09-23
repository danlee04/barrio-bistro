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
     * Keep only the field that belongs to the chosen order type.
     */
    protected function prepareForValidation(): void
    {
        $isDineIn = $this->input('type') === OrderType::DineIn->value;
        $name = trim((string) $this->input('customer_name', ''));

        $this->merge([
            'table_number' => $isDineIn ? $this->input('table_number') : null,
            'customer_name' => $isDineIn || $name === '' ? null : $name,
        ]);
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
                Rule::requiredIf(fn (): bool => $this->input('type') === OrderType::DineIn->value),
                'nullable',
                'integer',
                'min:1',
                'max:'.(int) config('restaurant.tables'),
            ],
            'customer_name' => [
                Rule::requiredIf(fn (): bool => $this->input('type') === OrderType::Takeout->value),
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
            'table_number.required' => 'Tell us which table you are on.',
            'table_number.max' => 'We do not have a table with that number.',
            'customer_name.required' => 'Add a name so we can call you.',
            'items.required' => 'Your order is empty.',
            'items.min' => 'Your order is empty.',
            'items.max' => 'That is too many dishes for one order. Please split it.',
        ];
    }
}
