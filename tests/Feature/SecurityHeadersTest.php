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
        // Exactly one 'unsafe-inline' may exist, and the next test pins it to
        // style-src-attr: scripts and stylesheets never get it.
        ->and(substr_count((string) $first, "'unsafe-inline'"))->toBe(1)
        ->and($first)->not->toContain("'unsafe-eval'");
});

test('the page shares the policy nonce so runtime-injected styles are allowed', function () {
    $response = $this->withoutVite()->get('/');

    preg_match("/'nonce-([^']+)'/", (string) $response->headers->get('Content-Security-Policy'), $policyNonce);

    expect($policyNonce)->toHaveKey(1)
        ->and($response->getContent())->toContain('<meta name="csp-nonce" content="'.$policyNonce[1].'">');
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

test('inline style attributes are allowed, but injected stylesheets are not', function () {
    $policy = $this->withoutVite()->get('/')->headers->get('Content-Security-Policy') ?? '';

    expect($policy)->toContain("style-src-attr 'unsafe-inline'")
        ->and($policy)->not->toContain("style-src 'self' 'unsafe-inline'")
        ->and($policy)->toContain("script-src 'self' 'nonce-");
});

test('the session cookie is secure in production without anyone remembering', function () {
    $previousEnv = $_ENV['APP_ENV'] ?? null;
    $previousServer = $_SERVER['APP_ENV'] ?? null;

    try {
        foreach (['local', 'production'] as $environment) {
            $_ENV['APP_ENV'] = $environment;
            $_SERVER['APP_ENV'] = $environment;

            $session = require base_path('config/session.php');

            expect($session['secure'])->toBe($environment === 'production');
        }
    } finally {
        $_ENV['APP_ENV'] = $previousEnv;
        $_SERVER['APP_ENV'] = $previousServer;
    }
});
