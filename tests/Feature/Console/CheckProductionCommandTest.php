<?php

/** Everything the command wants, so a test can spoil one thing at a time. */
function productionConfig(array $overrides = []): array
{
    return array_merge([
        'app.env' => 'production',
        'app.debug' => false,
        'app.key' => 'base64:'.base64_encode(random_bytes(32)),
        'app.url' => 'https://barriobistro.ph',
        'session.secure' => true,
        'session.encrypt' => true,
        'security.csp_report_only' => false,
        'security.trusted_proxies' => ['10.0.0.0/8'],
        'paymongo.secret_key' => '',
        'paymongo.webhook_secret' => '',
    ], $overrides);
}

/** The symlink cannot be made in a test, so a plain directory stands in. */
function withUploadsReachable(Closure $body): void
{
    $link = public_path('storage');
    $created = ! is_dir($link);

    if ($created) {
        mkdir($link, 0o755, true);
        // PHP caches the earlier "no such directory", so the command would
        // still be told it is missing.
        clearstatcache(true, $link);
    }

    try {
        $body();
    } finally {
        if ($created) {
            rmdir($link);
            clearstatcache(true, $link);
        }
    }
}

test('a development install is refused', function () {
    config(['app.env' => 'local', 'app.debug' => true]);

    $this->artisan('app:check-production')->assertFailed();
});

test('a properly set up production install passes', function () {
    config(productionConfig());

    withUploadsReachable(function () {
        $this->artisan('app:check-production')->assertSuccessful();
    });
});

test('debug mode alone stops the deploy', function () {
    config(productionConfig(['app.debug' => true]));

    withUploadsReachable(function () {
        $this->artisan('app:check-production')->assertFailed();
    });
});

test('a session cookie that is not HTTPS-only stops the deploy', function () {
    config(productionConfig(['session.secure' => false]));

    withUploadsReachable(function () {
        $this->artisan('app:check-production')->assertFailed();
    });
});

test('a PayMongo key with no webhook secret stops the deploy', function () {
    config(productionConfig(['paymongo.secret_key' => 'sk_live_example']));

    withUploadsReachable(function () {
        $this->artisan('app:check-production')->assertFailed();
    });
});

test('missing trusted proxies is a warning, not a refusal', function () {
    config(productionConfig(['security.trusted_proxies' => []]));

    withUploadsReachable(function () {
        $this->artisan('app:check-production')->assertSuccessful();
    });
});
