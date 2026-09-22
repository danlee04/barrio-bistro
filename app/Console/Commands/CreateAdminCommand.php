<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

#[Signature('app:create-admin')]
#[Description('Create an admin account (the password is prompted, never passed as an argument)')]
class CreateAdminCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $name = text(label: 'Name', required: true);
        $email = Str::lower(trim(text(label: 'Email', required: true)));
        $password = password(label: 'Password', required: true);
        $confirmation = password(label: 'Confirm password', required: true);

        if ($password !== $confirmation) {
            $this->components->error('Passwords do not match. Nothing was created.');

            return self::FAILURE;
        }

        $validator = Validator::make(
            ['name' => $name, 'email' => $email, 'password' => $password],
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'string', 'email', 'max:255', Rule::unique(User::class, 'email')],
                'password' => ['required', 'string', Password::defaults()],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->components->error($error);
            }

            return self::FAILURE;
        }

        $admin = DB::transaction(function () use ($name, $email, $password): User {
            $admin = new User(['name' => $name, 'email' => $email, 'password' => $password]);
            $admin->forceFill([
                'role' => Role::Admin,
                'is_active' => true,
                'must_change_password' => false,
                'email_verified_at' => now(),
            ])->save();

            AuditLog::record('staff.created', $admin, context: ['role' => Role::Admin->value, 'via' => 'console']);

            return $admin;
        });

        $this->components->info("Admin account created for {$admin->email}.");

        return self::SUCCESS;
    }
}
