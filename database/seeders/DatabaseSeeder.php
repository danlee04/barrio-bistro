<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed demo staff for local development only.
     *
     * The first admin is created with `php artisan app:create-admin`, so no
     * account with a known password is ever seeded into a real environment.
     */
    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        User::factory()->cashier()->count(3)->create();
        User::factory()->kitchen()->count(2)->create();
    }
}
