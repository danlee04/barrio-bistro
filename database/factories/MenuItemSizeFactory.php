<?php

namespace Database\Factories;

use App\Models\MenuItem;
use App\Models\MenuItemSize;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MenuItemSize>
 */
class MenuItemSizeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'menu_item_id' => MenuItem::factory(),
            'name' => Str::title(fake()->unique()->word()),
            'price' => fake()->numberBetween(50, 400) * 100,
            'sort_order' => 0,
        ];
    }
}
