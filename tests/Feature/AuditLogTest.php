<?php

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;

test('an event records the actor, subject, origin and context', function () {
    $admin = User::factory()->admin()->create();
    $staff = User::factory()->create();
    $this->actingAs($admin);

    $log = AuditLog::record('staff.created', $staff, context: ['role' => 'kitchen']);

    expect($log->causer_id)->toBe($admin->id)
        ->and($log->subject_type)->toBe($staff->getMorphClass())
        ->and($log->subject_id)->toBe($staff->id)
        ->and($log->context)->toBe(['role' => 'kitchen'])
        ->and($log->ip_address)->toBe('127.0.0.1');
});

test('sensitive values are redacted at any depth', function () {
    $log = AuditLog::record('test.event', context: [
        'password' => 'hunter2-hunter2',
        'nested' => ['current_password' => 'secret-value', 'note' => 'kept'],
    ]);

    expect($log->context)->toBe([
        'password' => '[REDACTED]',
        'nested' => ['current_password' => '[REDACTED]', 'note' => 'kept'],
    ]);
});

test('a change records the before and after values of the last save', function () {
    $staff = User::factory()->cashier()->create();
    $staff->role = Role::Kitchen;
    $staff->save();

    $log = AuditLog::recordChange('staff.updated', $staff);

    expect($log->changes)->toBe(['role' => ['from' => 'cashier', 'to' => 'kitchen']]);
});

test('a password change is logged without the password', function () {
    $staff = User::factory()->create();
    $staff->forceFill(['password' => 'a-brand-new-passphrase'])->save();

    $log = AuditLog::recordChange('staff.updated', $staff);

    expect($log->changes['password'])->toBe('[REDACTED]');
});

test('audit entries are append-only', function () {
    expect(AuditLog::record('test.event')->getAttributes())->not->toHaveKey('updated_at');
});
