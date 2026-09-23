<?php

test('the cart is told what it may offer', function () {
    config()->set('paymongo.secret_key', 'sk_test_secret');
    config()->set('restaurant.tables', 12);

    $this->getJson('/api/v1/checkout/options')
        ->assertOk()
        ->assertJsonPath('data.tables', 12)
        ->assertJsonPath('data.methods', ['counter', 'online'])
        ->assertJsonPath('data.online_minimum', 10000);
});

test('online disappears entirely when there is no key', function () {
    config()->set('paymongo.secret_key', '');

    $this->getJson('/api/v1/checkout/options')
        ->assertOk()
        ->assertJsonPath('data.methods', ['counter']);
});
