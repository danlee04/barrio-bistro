<?php

test('html responses carry a strict nonce-based content security policy', function () {
    $first = $this->withoutVite()->get('/')->headers->get('Content-Security-Policy');
    $second = $this->withoutVite()->get('/')->headers->get('Content-Security-Policy');

    expect($first)->not->toBeNull()
        ->and($first)->not->toBe($second)
        ->and($first)->toContain("default-src 'self'")
        ->and($first)->toContain("script-src 'self' 'nonce-")
        ->and($first)->toContain("object-src 'none'")
        ->and($first)->toContain("frame-ancestors 'none'")
        ->and($first)->toContain("form-action 'self'")
        ->and($first)->not->toContain("'unsafe-inline'")
        ->and($first)->not->toContain("'unsafe-eval'");
});

test('every response carries the baseline security headers', function (string $uri) {
    $this->withoutVite()
        ->get($uri)
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin');
})->with(['/', '/api/v1/me']);

test('json responses do not carry a content security policy', function () {
    $this->getJson('/api/v1/me')->assertHeaderMissing('Content-Security-Policy');
});

test('hsts is not sent over plain http outside production', function () {
    $this->withoutVite()->get('/')->assertHeaderMissing('Strict-Transport-Security');
});

test('the session cookie is http-only, same-site lax, and sessions are encrypted', function () {
    $sessionCookie = collect($this->withoutVite()->get('/')->headers->getCookies())
        ->first(fn ($cookie) => $cookie->getName() === config('session.cookie'));

    expect($sessionCookie)->not->toBeNull()
        ->and($sessionCookie->isHttpOnly())->toBeTrue()
        ->and($sessionCookie->getSameSite())->toBe('lax')
        ->and(config('session.encrypt'))->toBeTrue();
});
