<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Encrypted, because the secret is the whole of the second factor:
            // anyone holding it can produce the six digits themselves.
            $table->text('two_factor_secret')->nullable()->after('password');

            // Hashed one by one, like passwords, so a stolen table is useless.
            $table->text('two_factor_recovery_codes')->nullable()->after('two_factor_secret');

            // Null until the staff member has typed a code back, so a setup
            // abandoned halfway can never lock anybody out.
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_recovery_codes');

            // The last half-minute a code was accepted for. A code shown to
            // somebody standing behind you is dead the moment it is used.
            $table->unsignedBigInteger('two_factor_last_step')->nullable()->after('two_factor_confirmed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'two_factor_secret',
                'two_factor_recovery_codes',
                'two_factor_confirmed_at',
                'two_factor_last_step',
            ]);
        });
    }
};
