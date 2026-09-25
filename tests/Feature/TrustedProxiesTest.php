<?php

use App\Models\AuditLog;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;

/**
 * The visitor's address is what every rate limiter counts, so it has to be the
 * visitor's and not the proxy's. The enquiry endpoint is used as the probe
 * because it writes the address it saw into the audit trail.
 */
function sendInquiryFrom(string $forwardedFor): void
{
    test()
        ->withServerVariables(['REMOTE_ADDR' => '10.0.0.5'])
        ->withHeaders(['X-Forwarded-For' => $forwardedFor])
        ->postJson('/api/v1/inquiries', [
            'type' => 'contact',
            'name' => 'Ben',
            'contact' => 'ben@example.com',
            'message' => 'Do you have parking at the back?',
        ])
        ->assertCreated();
}

function seenAddress(): ?string
{
    return AuditLog::query()->where('action', 'inquiry.received')->sole()->ip_address;
}

test('a forwarded address is ignored when no proxy is trusted', function () {
    TrustProxies::at([]);

    sendInquiryFrom('203.0.113.9');

    expect(seenAddress())->toBe('10.0.0.5');
});

test('a forwarded address is read when the proxy in front is trusted', function () {
    TrustProxies::at(['10.0.0.5']);
    TrustProxies::withHeaders(
        Request::HEADER_X_FORWARDED_FOR
        | Request::HEADER_X_FORWARDED_PORT
        | Request::HEADER_X_FORWARDED_PROTO
    );

    sendInquiryFrom('203.0.113.9');

    expect(seenAddress())->toBe('203.0.113.9');

    TrustProxies::at([]);
});

test('a stranger cannot pretend to be the proxy', function () {
    TrustProxies::at(['192.0.2.7']);

    sendInquiryFrom('203.0.113.9');

    expect(seenAddress())->toBe('10.0.0.5');

    TrustProxies::at([]);
});

test('the trusted list is empty until the shop names its proxies', function () {
    expect(config('security.trusted_proxies'))->toBe([]);
});
