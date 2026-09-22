<?php

use App\Models\User;

test('the csrf cookie endpoint issues an XSRF-TOKEN cookie', function () {
    $this->get('/sanctum/csrf-cookie')
        ->assertNoContent()
        ->assertCookie('XSRF-TOKEN');
});

test('guests cannot read the current user from the api', function () {
    $this->getJson('/api/v1/user')->assertUnauthorized();
});

test('staff can log in through the spa and read their profile from the api', function () {
    $user = User::factory()->create();

    $this->withHeader('Referer', config('app.url'))
        ->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])
        ->assertNoContent();

    $this->withHeader('Referer', config('app.url'))
        ->getJson('/api/v1/user')
        ->assertOk()
        ->assertJsonPath('email', $user->email);
});

test('the old unversioned api path is not served', function () {
    $this->getJson('/api/user')->assertNotFound();
});
