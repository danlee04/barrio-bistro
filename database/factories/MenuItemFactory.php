<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MenuItem>
 */
class MenuItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'category_id' => Category::factory(),
            'name' => Str::title(rtrim(fake()->unique()->sentence(3), '.')),
            'description' => fake()->sentence(),
            'is_available' => true,
            'is_featured' => false,
            'sort_order' => 0,
        ];
    }

    /**
     * Give every created item a "Regular" size unless the test supplied sizes.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (MenuItem $item): void {
            if ($item->sizes()->doesntExist()) {
                $item->sizes()->create([
                    'name' => 'Regular',
                    'price' => fake()->numberBetween(50, 400) * 100,
                    'sort_order' => 0,
                ]);
            }
        });
    }

    /**
     * Indicate that the item is sold out.
     */
    public function unavailable(): static
    {
        return $this->state(fn (array $attributes) => ['is_available' => false]);
    }

    /**
     * Indicate that the item is featured in the hero.
     */
    public function featured(): static
    {
        return $this->state(fn (array $attributes) => ['is_featured' => true]);
    }
}
