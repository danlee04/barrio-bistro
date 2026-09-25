<?php

use App\Models\AuditLog;
use App\Models\Inquiry;

test('a message past its retention is deleted, whatever its status', function () {
    config(['security.inquiry_retention_days' => 365]);

    $old = Inquiry::factory()->create(['created_at' => now()->subDays(400)]);
    $oldButNew = Inquiry::factory()->create(['created_at' => now()->subDays(366)]);
    $recent = Inquiry::factory()->create(['created_at' => now()->subDays(364)]);

    $this->artisan('model:prune', ['--model' => [Inquiry::class]])->assertSuccessful();

    expect(Inquiry::query()->pluck('id')->all())->toBe([$recent->id])
        ->and(Inquiry::query()->find($old->id))->toBeNull()
        ->and(Inquiry::query()->find($oldButNew->id))->toBeNull();
});

test('the pruning is recorded without the message itself', function () {
    config(['security.inquiry_retention_days' => 30]);

    $inquiry = Inquiry::factory()->bulk()->create([
        'created_at' => now()->subDays(60),
        'name' => 'Aling Nena',
        'contact' => 'nena@example.com',
    ]);

    $this->artisan('model:prune', ['--model' => [Inquiry::class]])->assertSuccessful();

    $entry = AuditLog::query()->where('action', 'inquiry.pruned')->sole();

    expect($entry->context)->toBe(['id' => $inquiry->id, 'type' => 'bulk'])
        ->and(json_encode($entry->getAttributes()))->not->toContain('nena@example.com')
        ->and(json_encode($entry->getAttributes()))->not->toContain('Aling Nena');
});

test('the retention period can be lengthened without touching code', function () {
    config(['security.inquiry_retention_days' => 3650]);

    Inquiry::factory()->create(['created_at' => now()->subDays(400)]);

    $this->artisan('model:prune', ['--model' => [Inquiry::class]])->assertSuccessful();

    expect(Inquiry::query()->count())->toBe(1);
});
