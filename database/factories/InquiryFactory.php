<?php

namespace Database\Factories;

use App\Enums\InquiryStatus;
use App\Enums\InquiryType;
use App\Models\Inquiry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Inquiry>
 */
class InquiryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => InquiryType::Contact,
            'name' => fake()->name(),
            'contact' => fake()->safeEmail(),
            'event_date' => null,
            'guests' => null,
            'message' => fake()->sentence(12),
            'status' => InquiryStatus::New,
        ];
    }

    /**
     * A party or an office asking to be fed.
     */
    public function bulk(): self
    {
        return $this->state(fn (): array => [
            'type' => InquiryType::Bulk,
            'event_date' => now()->addWeeks(2)->toDateString(),
            'guests' => fake()->numberBetween(20, 120),
        ]);
    }

    /**
     * Already dealt with.
     */
    public function closed(): self
    {
        return $this->state(fn (): array => ['status' => InquiryStatus::Closed]);
    }
}
