<?php

test('the home page serves the spa shell', function () {
    $this->withoutVite()
        ->get('/')
        ->assertOk()
        ->assertViewIs('app')
        ->assertSee('<div id="app"></div>', false);
});

test('deep links serve the spa shell so react router can handle them', function (string $path) {
    $this->withoutVite()
        ->get($path)
        ->assertOk()
        ->assertViewIs('app');
})->with(['/menu', '/menu/meals', '/admin/orders']);

test('unknown api paths return json 404 instead of the spa shell', function () {
    $this->getJson('/api/v1/does-not-exist')
        ->assertNotFound()
        ->assertJsonStructure(['message']);
});
