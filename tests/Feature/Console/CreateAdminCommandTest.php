<?php

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('the first admin can be created from the console', function () {
    $this->artisan('app:create-admin')
        ->expectsQuestion('Name', 'Maria Santos')
        ->expectsQuestion('Email', 'Maria@BarrioBistro.test')
        ->expectsQuestion('Password', 'a-strong-admin-passphrase')
        ->expectsQuestion('Confirm password', 'a-strong-admin-passphrase')
        ->expectsOutputToContain('Admin account created')
        ->assertSuccessful();

    $admin = User::query()->where('email', 'maria@barriobistro.test')->sole();

    expect($admin->role)->toBe(Role::Admin)
        ->and($admin->is_active)->toBeTrue()
        ->and($admin->must_change_password)->toBeFalse()
        ->and(Hash::check('a-strong-admin-passphrase', $admin->password))->toBeTrue();
    $this->assertDatabaseHas('audit_logs', ['action' => 'staff.created', 'subject_id' => $admin->id]);
});

test('mismatched passwords create nothing', function () {
    $this->artisan('app:create-admin')
        ->expectsQuestion('Name', 'Maria Santos')
        ->expectsQuestion('Email', 'maria@barriobistro.test')
        ->expectsQuestion('Password', 'a-strong-admin-passphrase')
        ->expectsQuestion('Confirm password', 'something-else-entirely')
        ->expectsOutputToContain('Passwords do not match')
        ->assertFailed();

    expect(User::query()->count())->toBe(0);
});

test('a weak password creates nothing', function () {
    $this->artisan('app:create-admin')
        ->expectsQuestion('Name', 'Maria Santos')
        ->expectsQuestion('Email', 'maria@barriobistro.test')
        ->expectsQuestion('Password', 'short')
        ->expectsQuestion('Confirm password', 'short')
        ->assertFailed();

    expect(User::query()->count())->toBe(0);
});
