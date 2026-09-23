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
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->ulid('token')->unique();
            $table->string('order_number', 20)->unique();
            $table->date('business_date');
            $table->unsignedInteger('daily_number');
            $table->string('type', 10);
            $table->unsignedSmallInteger('table_number')->nullable();
            $table->string('customer_name', 40)->nullable();
            $table->string('status', 12)->default('pending');
            $table->string('payment_status', 10)->default('unpaid');
            $table->string('payment_method', 10);
            $table->unsignedInteger('subtotal');
            $table->unsignedInteger('total');
            $table->timestamps();

            $table->unique(['business_date', 'daily_number']);
            $table->index(['status', 'id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
