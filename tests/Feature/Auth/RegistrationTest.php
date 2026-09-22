<?php

test('public self-registration is closed', function () {
    $this->postJson('/register', [
        'name' => 'Intruder',
        'email' => 'intruder@example.com',
        'password' => 'a-long-enough-passphrase',
        'password_confirmation' => 'a-long-enough-passphrase',
    ])->assertMethodNotAllowed();

    $this->assertGuest();
    $this->assertDatabaseMissing('users', ['email' => 'intruder@example.com']);
});
