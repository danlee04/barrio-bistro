<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Database\Seeder;

/**
 * A menu to build against, so the screens are never judged empty.
 *
 * Run it with `php artisan db:seed --class=SampleMenuSeeder`. It adds nothing
 * twice: a dish that is already there is left exactly as the shop set it, so
 * running it on a live menu is safe.
 */
class SampleMenuSeeder extends Seeder
{
    /**
     * @var array<int, array{name: string, description: string, items: array<int, array{name: string, description: string, featured?: bool, sizes: array<string, int>}>}>
     */
    private const MENU = [
        [
            'name' => 'Meals',
            'description' => 'Rice meals from the neighbourhood kitchen.',
            'items' => [
                [
                    'name' => 'Pork Adobo',
                    'description' => 'Pork belly darkened slowly in soy, vinegar and plenty of garlic.',
                    'featured' => true,
                    'sizes' => ['Solo' => 18000, 'Sharing' => 32000],
                ],
                [
                    'name' => 'Chicken Adobo',
                    'description' => 'The same pot, with chicken thighs and a longer simmer.',
                    'sizes' => ['Solo' => 17000, 'Sharing' => 30000],
                ],
                [
                    'name' => 'Pork Sisig',
                    'description' => 'Chopped, crisped and served still crackling on cast iron.',
                    'featured' => true,
                    'sizes' => ['Solo' => 22000, 'Sharing' => 38000],
                ],
                [
                    'name' => 'Kare-Kare',
                    'description' => 'Oxtail and vegetables in thick peanut sauce, with bagoong on the side.',
                    'featured' => true,
                    'sizes' => ['Solo' => 26000, 'Sharing' => 45000],
                ],
                [
                    'name' => 'Bicol Express',
                    'description' => 'Pork in coconut milk with plenty of siling labuyo.',
                    'sizes' => ['Solo' => 20000],
                ],
                [
                    'name' => 'Sinigang na Baboy',
                    'description' => 'Sour tamarind broth, pork ribs and garden vegetables.',
                    'sizes' => ['Solo' => 21000, 'Sharing' => 37000],
                ],
            ],
        ],
        [
            'name' => 'Noodles',
            'description' => 'For the table, or for a birthday.',
            'items' => [
                [
                    'name' => 'Pancit Bihon',
                    'description' => 'Thin rice noodles with pork, shrimp and cabbage.',
                    'sizes' => ['Solo' => 14000, 'Bilao' => 65000],
                ],
                [
                    'name' => 'Pancit Canton',
                    'description' => 'Egg noodles tossed with vegetables and a squeeze of kalamansi.',
                    'sizes' => ['Solo' => 15000, 'Bilao' => 68000],
                ],
            ],
        ],
        [
            'name' => 'Snacks',
            'description' => 'Small plates while you wait.',
            'items' => [
                [
                    'name' => 'Lumpiang Shanghai',
                    'description' => 'Ten pieces, fried to order, with sweet chilli.',
                    'featured' => true,
                    'sizes' => ['10 pieces' => 12000],
                ],
                [
                    'name' => 'Tokwa\'t Baboy',
                    'description' => 'Fried tofu and pork in a sharp soy and vinegar dip.',
                    'sizes' => ['Regular' => 13000],
                ],
                [
                    'name' => 'Calamares',
                    'description' => 'Squid rings in a light batter, with garlic mayo.',
                    'sizes' => ['Regular' => 16000],
                ],
            ],
        ],
        [
            'name' => 'Rice',
            'description' => 'Because everything here wants rice.',
            'items' => [
                [
                    'name' => 'Steamed Rice',
                    'description' => 'One cup, freshly steamed.',
                    'sizes' => ['Cup' => 2500],
                ],
                [
                    'name' => 'Garlic Rice',
                    'description' => 'Fried with toasted garlic.',
                    'sizes' => ['Cup' => 3500],
                ],
            ],
        ],
        [
            'name' => 'Drinks',
            'description' => 'Cold, and mostly local.',
            'items' => [
                [
                    'name' => 'Sago\'t Gulaman',
                    'description' => 'Brown sugar, pearls and jelly over ice.',
                    'sizes' => ['12oz' => 6000, '16oz' => 8000],
                ],
                [
                    'name' => 'Fresh Kalamansi',
                    'description' => 'Squeezed to order, sweet or plain.',
                    'sizes' => ['12oz' => 5500, '16oz' => 7500],
                ],
                [
                    'name' => 'Bottled Water',
                    'description' => '500ml.',
                    'sizes' => ['500ml' => 2500],
                ],
            ],
        ],
        [
            'name' => 'Desserts',
            'description' => 'Sweet endings.',
            'items' => [
                [
                    'name' => 'Halo-Halo',
                    'description' => 'Shaved ice, beans, leche flan and ube on top.',
                    'featured' => true,
                    'sizes' => ['Regular' => 13000, 'Special' => 17000],
                ],
                [
                    'name' => 'Leche Flan',
                    'description' => 'One slice, steamed and turned out in its own caramel.',
                    'sizes' => ['Slice' => 8000],
                ],
            ],
        ],
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach (self::MENU as $position => $group) {
            $category = Category::query()->firstOrCreate(
                ['name' => $group['name']],
                ['description' => $group['description'], 'sort_order' => $position],
            );

            foreach ($group['items'] as $order => $dish) {
                if (MenuItem::query()->where('name', $dish['name'])->exists()) {
                    continue;
                }

                $item = new MenuItem([
                    'category_id' => $category->id,
                    'name' => $dish['name'],
                    'description' => $dish['description'],
                    'is_featured' => $dish['featured'] ?? false,
                ]);

                $item->sort_order = $order;
                $item->save();

                $item->syncSizes(array_map(
                    fn (string $name, int $price): array => ['name' => $name, 'price' => $price],
                    array_keys($dish['sizes']),
                    $dish['sizes'],
                ));
            }
        }
    }
}
