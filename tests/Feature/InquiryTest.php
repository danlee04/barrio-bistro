<?php

use App\Enums\InquiryStatus;
use App\Enums\InquiryType;
use App\Models\AuditLog;
use App\Models\Inquiry;
use App\Models\User;

/** A bulk-order enquiry as the website sends it. */
function bulkPayload(array $overrides = []): array
{
    return array_merge([
        'type' => 'bulk',
        'name' => 'Aling Nena',
        'contact' => 'nena@example.com',
        'event_date' => now()->addWeeks(3)->toDateString(),
        'guests' => 40,
        'message' => 'Office Christmas party, we need pancit and lechon kawali.',
    ], $overrides);
}

test('a visitor can send a bulk order enquiry', function () {
    $this->postJson('/api/v1/inquiries', bulkPayload())
        ->assertCreated()
        ->assertJsonPath('message', 'Thanks. We will get back to you.');

    $inquiry = Inquiry::query()->sole();

    expect($inquiry->type)->toBe(InquiryType::Bulk)
        ->and($inquiry->status)->toBe(InquiryStatus::New)
        ->and($inquiry->guests)->toBe(40);
});

test('an ordinary message needs no date or headcount', function () {
    $this->postJson('/api/v1/inquiries', [
        'type' => 'contact',
        'name' => 'Ben',
        'contact' => '0917 555 1234',
        'message' => 'Do you have parking at the back?',
    ])->assertCreated();

    $inquiry = Inquiry::query()->sole();

    expect($inquiry->type)->toBe(InquiryType::Contact)
        ->and($inquiry->event_date)->toBeNull()
        ->and($inquiry->guests)->toBeNull();
});

test('the enquiry never reaches the audit trail in full', function () {
    $this->postJson('/api/v1/inquiries', bulkPayload())->assertCreated();

    $entry = AuditLog::query()->where('action', 'inquiry.received')->sole();

    expect($entry->context)->toBe(['type' => 'bulk'])
        ->and(json_encode($entry->getAttributes()))->not->toContain('nena@example.com');
});

test('a bulk order without a date or a headcount is refused', function () {
    $this->postJson('/api/v1/inquiries', bulkPayload([
        'event_date' => null,
        'guests' => null,
    ]))->assertJsonValidationErrors(['event_date', 'guests']);

    expect(Inquiry::query()->count())->toBe(0);
});

test('a date in the past and a contact that is neither email nor phone are refused', function () {
    $this->postJson('/api/v1/inquiries', bulkPayload([
        'event_date' => now()->subDay()->toDateString(),
        'contact' => 'talk to me',
    ]))->assertJsonValidationErrors(['event_date', 'contact']);

    expect(Inquiry::query()->count())->toBe(0);
});

test('every field is bounded', function () {
    $this->postJson('/api/v1/inquiries', bulkPayload([
        'name' => str_repeat('a', 81),
        'message' => str_repeat('b', 2001),
        'guests' => 5000,
    ]))->assertJsonValidationErrors(['name', 'message', 'guests']);
});

test('the empty honeypot the real form sends is not mistaken for a field', function () {
    $this->postJson('/api/v1/inquiries', bulkPayload(['website' => '']))
        ->assertCreated();

    expect(Inquiry::query()->count())->toBe(1);
});

test('anything that fills the honeypot is refused', function () {
    $this->postJson('/api/v1/inquiries', bulkPayload(['website' => 'https://spam.example']))
        ->assertJsonValidationErrors(['website']);

    expect(Inquiry::query()->count())->toBe(0);
});

test('the form is throttled by address', function () {
    foreach (range(1, 3) as $attempt) {
        $this->postJson('/api/v1/inquiries', bulkPayload())->assertCreated();
    }

    $this->postJson('/api/v1/inquiries', bulkPayload())->assertStatus(429);
});

test('a status change is recorded against the staff member who made it', function () {
    $admin = User::factory()->admin()->create();
    $inquiry = Inquiry::factory()->bulk()->create();

    $this->actingAs($admin)
        ->patchJson("/api/v1/admin/inquiries/{$inquiry->id}", ['status' => 'closed'])
        ->assertOk()
        ->assertJsonPath('data.status', 'closed')
        ->assertJsonPath('data.status_label', 'Closed');

    $entry = AuditLog::query()->where('action', 'inquiry.status_changed')->sole();

    expect($entry->causer_id)->toBe($admin->id)
        ->and($entry->changes)->toBe(['status' => ['from' => 'new', 'to' => 'closed']]);
});

test('admins read the message book newest first and can narrow it', function () {
    $admin = User::factory()->admin()->create();

    Inquiry::factory()->create(['name' => 'Oldest']);
    Inquiry::factory()->bulk()->create(['name' => 'Newest']);
    Inquiry::factory()->closed()->create(['name' => 'Done with']);

    $this->actingAs($admin)
        ->getJson('/api/v1/admin/inquiries')
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('data.0.name', 'Done with');

    $this->actingAs($admin)
        ->getJson('/api/v1/admin/inquiries?status=new&type=bulk')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Newest');
});

test('nobody but an admin may read the message book', function () {
    $inquiry = Inquiry::factory()->create();

    $this->getJson('/api/v1/admin/inquiries')->assertUnauthorized();

    foreach (['cashier', 'kitchen'] as $role) {
        $staff = User::factory()->{$role}()->create();

        $this->actingAs($staff)->getJson('/api/v1/admin/inquiries')->assertForbidden();
        $this->actingAs($staff)
            ->patchJson("/api/v1/admin/inquiries/{$inquiry->id}", ['status' => 'read'])
            ->assertForbidden();
    }

    expect($inquiry->fresh()->status)->toBe(InquiryStatus::New);
});
