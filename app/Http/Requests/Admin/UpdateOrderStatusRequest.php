<?php

namespace App\Http\Requests\Admin;

use App\Enums\OrderStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderStatusRequest extends FormRequest
{
    /**
     * The controller authorizes the particular move, since who may make it
     * depends on where the order is going.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => [
                'required',
                Rule::enum(OrderStatus::class)->only([
                    OrderStatus::Preparing,
                    OrderStatus::Ready,
                    OrderStatus::Completed,
                    OrderStatus::Cancelled,
                ]),
            ],
            'reason' => ['nullable', 'string', 'max:120'],
        ];
    }
}
