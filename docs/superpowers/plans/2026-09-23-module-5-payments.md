# Module 5 — Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a guest pay an order online through PayMongo (GCash or card), and let a cashier record a payment taken at the counter — with `paid` only ever written after the server itself has checked with PayMongo.

**Architecture:** A `payments` row records every attempt. Online payment uses a PayMongo **Checkout Session**: the guest is sent to PayMongo's hosted page, so no card data reaches this app. Confirmation arrives two ways — the signed webhook (production) and a server-to-server re-read of the session when the guest returns (works on localhost) — and both run through one idempotent `PaymentConfirmer` that re-checks the amount before marking anything paid. Counter payments go through the same confirmer from a policy-guarded staff endpoint.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5, PHPStan level 7 (Larastan), Pint, `Http` client with `Http::fake()` in tests, React 19, React Router 8, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md` (§4 Data Model, §5 Order State Machine, §6 Security Layers)

## Global Constraints

- **`paid` is set only by the webhook, never by the success redirect, because a customer can fake the redirect.** (spec §5) The return path in this module is a _server-to-server_ read of the PayMongo session, which is the same trust level as the webhook — never the redirect's own word.
- **PayMongo webhook signature verification.** (spec §6)
- **Webhook idempotency via the unique `provider_reference`.** (spec §6)
- **Money is integer centavos**, and PayMongo also takes centavos as integers.
- Status and payment status stay independent tracks: paying moves `payment_status` to `paid` and lifts `status` from `pending` to `confirmed` only when it is still `pending`. A `preparing` or `ready` order never moves backwards. (spec §5)
- A Form Request on every write endpoint; explicit `$fillable`; API Resources on every response. (spec §6)
- Audit log entries for every payment event, with no card data, no billing name and no raw provider payload. (spec §6, RA 10173 data minimisation)
- Brainstorming decisions (2026-09-23): **GCash + card**; keys arrive later, so the app must work with the online option **hidden** when no key is set; **"Mark as Paid" is an API in this module** and its screen comes in Module 6; an unfinished payment **leaves the order waiting** — the guest may retry or pay at the counter, with one `payments` row per attempt.
- PayMongo facts confirmed from the docs on 2026-09-23: `POST https://api.paymongo.com/v1/checkout_sessions`, HTTP Basic auth with the secret key as username and an empty password, `line_items[].amount` in centavos, `payment_method_types` required. Webhook signature header `Paymongo-Signature: t=<unix>,te=<test>,li=<live>`; the signed string is `t + "." + raw body`, HMAC-SHA256 with the endpoint's webhook secret, compared against `te` in test mode and `li` in live mode.
- After every PHP edit run `vendor/bin/pint --dirty --format agent`.
- Commands the **user** runs: `php artisan migrate`, any install, and `git commit`.

## File Structure

**Backend**

| File                                                              | Responsibility                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| `config/paymongo.php`                                             | Keys, base URL, enabled methods, online minimum, signature tolerance |
| `database/migrations/2026_09_23_010000_create_payments_table.php` | `payments`                                                           |
| `app/Enums/PaymentProvider.php`                                   | `paymongo` / `counter`                                               |
| `app/Enums/PaymentState.php`                                      | One attempt's own state: `pending` / `paid` / `failed`               |
| `app/Models/Payment.php`, `database/factories/PaymentFactory.php` | The attempt record                                                   |
| `app/Services/PayMongoClient.php`                                 | The only place that talks to PayMongo                                |
| `app/Services/PaymentConfirmer.php`                               | The only place that writes `paid`                                    |
| `app/Http/Middleware/VerifyPayMongoSignature.php`                 | Rejects anything PayMongo did not sign                               |
| `app/Http/Controllers/CheckoutOptionsController.php`              | What the cart may offer: tables, methods, minimum                    |
| `app/Http/Controllers/OrderPaymentController.php`                 | `session` (start), `refresh` (return path)                           |
| `app/Http/Controllers/PayMongoWebhookController.php`              | The signed event                                                     |
| `app/Http/Controllers/Admin/OrderPaymentController.php`           | Cashier's "Mark as Paid"                                             |
| `app/Policies/OrderPolicy.php`                                    | `markPaid`: Admin and Cashier, never on a cancelled or paid order    |
| `app/Http/Resources/PaymentResource.php`                          | Guest-safe payment JSON                                              |
| `app/Enums/PaymentMethod.php`                                     | _Modify:_ add `Online`                                               |
| `app/Http/Controllers/CurrentUserController.php`                  | _Modify:_ add the `mark_paid` ability                                |
| `routes/api.php`, `app/Providers/AppServiceProvider.php`          | Routes, the `payments` limiter                                       |

**Frontend**

| File                                  | Responsibility                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `resources/js/lib/payments.ts`        | `checkoutOptions()`, `createCheckoutSession()`, `refreshPayment()`, `canPayOnline()` |
| `resources/js/types/order.ts`         | _Modify:_ `online` method, `CheckoutOptions`, `payment_state`                        |
| `resources/js/pages/cart.tsx`         | _Modify:_ the payment choice, and the redirect to PayMongo                           |
| `resources/js/pages/order-status.tsx` | _Modify:_ pay / retry / paid states                                                  |
| `resources/js/router.tsx`             | _Modify:_ `/cart` loader for the checkout options                                    |

**Tests**

| File                                             | Covers                                                |
| ------------------------------------------------ | ----------------------------------------------------- |
| `tests/Feature/Payments/PayMongoClientTest.php`  | Request shape, auth, centavos, failure returning null |
| `tests/Feature/Payments/CheckoutSessionTest.php` | Starting a payment, the guards, the throttle          |
| `tests/Feature/Payments/PaymentRefreshTest.php`  | The return path, amount mismatch, idempotency         |
| `tests/Feature/Payments/PayMongoWebhookTest.php` | Signature, replay, unknown events, wrong amount       |
| `tests/Feature/Payments/MarkPaidTest.php`        | Policy, audit trail, double payment refused           |
| `tests/Feature/Payments/CheckoutOptionsTest.php` | What the cart is told                                 |
| `resources/js/lib/payments.test.ts`              | `canPayOnline`                                        |

---

### Task 1: Payments schema, enums and model

**Files:**

- Create: `config/paymongo.php`
- Create: `database/migrations/2026_09_23_010000_create_payments_table.php`
- Create: `app/Enums/PaymentProvider.php`, `app/Enums/PaymentState.php`
- Create: `app/Models/Payment.php`, `database/factories/PaymentFactory.php`
- Modify: `app/Enums/PaymentMethod.php` (add `Online`), `app/Models/Order.php` (add `payments()`)
- Modify: `.env.example`
- Test: `tests/Feature/Payments/PaymentModelTest.php`

**Interfaces:**

- Produces: `Payment` with `order()`, `receiver()`, casts to `PaymentProvider` / `PaymentState`; `Order::payments()` (`HasMany`, newest first) and `Order::latestPayment()`; `config('paymongo.*')`; `PaymentMethod::Online`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Payments/PaymentModelTest.php`:

```php
<?php

use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;

test('a payment belongs to an order and casts its provider and state', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    $payment = Payment::factory()->for($order)->create(['amount' => 36000]);

    expect($payment->provider)->toBe(PaymentProvider::PayMongo)
        ->and($payment->state)->toBe(PaymentState::Pending)
        ->and($payment->amount)->toBe(36000)
        ->and($payment->order->is($order))->toBeTrue()
        ->and($order->payments()->count())->toBe(1);
});

test('two attempts cannot share one provider reference', function () {
    $order = Order::factory()->create();
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_same']);

    expect(fn () => Payment::factory()->for($order)->create(['provider_reference' => 'cs_same']))
        ->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});

test('counter payments carry no reference and remember the cashier', function () {
    $cashier = User::factory()->cashier()->create();
    $order = Order::factory()->create();

    Payment::factory()->for($order)->counter()->create(['received_by' => $cashier->id]);
    Payment::factory()->for($order)->counter()->create(['received_by' => $cashier->id]);

    expect($order->payments()->whereNull('provider_reference')->count())->toBe(2)
        ->and($order->latestPayment()?->receiver?->is($cashier))->toBeTrue();
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Payments/PaymentModelTest.php`
Expected: FAIL — `Class "App\Models\Payment" not found`.

(If `User::factory()->cashier()` does not exist, check `database/factories/UserFactory.php` for the role states it does have and use that one.)

- [ ] **Step 3: Write `config/paymongo.php`**

```php
<?php

return [

    /*
    |--------------------------------------------------------------------------
    | API Keys
    |--------------------------------------------------------------------------
    |
    | The secret key talks to PayMongo; the webhook secret proves an incoming
    | event came from them. With no secret key, online payment is switched off
    | everywhere and the app simply offers paying at the counter.
    |
    */

    'secret_key' => (string) env('PAYMONGO_SECRET_KEY', ''),

    'webhook_secret' => (string) env('PAYMONGO_WEBHOOK_SECRET', ''),

    'base_url' => (string) env('PAYMONGO_BASE_URL', 'https://api.paymongo.com/v1'),

    /*
    |--------------------------------------------------------------------------
    | Payment Methods
    |--------------------------------------------------------------------------
    |
    | The methods offered on PayMongo's hosted page. Each one must also be
    | switched on in the PayMongo dashboard.
    |
    */

    'methods' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('PAYMONGO_METHODS', 'gcash,card')),
    ))),

    /*
    |--------------------------------------------------------------------------
    | Online Minimum
    |--------------------------------------------------------------------------
    |
    | Smallest order, in centavos, that may be paid online. PayMongo's API
    | floor is PHP 1.00, but e-wallets in practice want PHP 100.00, so that is
    | the default. Anything smaller is paid at the counter.
    |
    */

    'minimum_amount' => (int) env('PAYMONGO_MINIMUM_AMOUNT', 10000),

    /*
    |--------------------------------------------------------------------------
    | Signature Tolerance
    |--------------------------------------------------------------------------
    |
    | How many seconds old a signed webhook may be before it is treated as a
    | replay.
    |
    */

    'signature_tolerance' => (int) env('PAYMONGO_SIGNATURE_TOLERANCE', 300),

];
```

Add to `.env.example`, under `RESTAURANT_TABLES`:

```dotenv
# Leave the key empty to hide online payment and take counter payments only.
PAYMONGO_SECRET_KEY=
PAYMONGO_WEBHOOK_SECRET=
PAYMONGO_METHODS=gcash,card
```

- [ ] **Step 4: Write the enums, and add `Online` to `PaymentMethod`**

`app/Enums/PaymentProvider.php`:

```php
<?php

namespace App\Enums;

enum PaymentProvider: string
{
    case PayMongo = 'paymongo';
    case Counter = 'counter';
}
```

`app/Enums/PaymentState.php`:

```php
<?php

namespace App\Enums;

/**
 * One payment attempt's own state. The order's overall standing is
 * `PaymentStatus`: an order with three failed attempts and one paid one is
 * simply paid.
 */
enum PaymentState: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Failed = 'failed';
}
```

In `app/Enums/PaymentMethod.php` add the case and its label:

```php
    case Counter = 'counter';
    case Online = 'online';
```

```php
            self::Counter => 'Pay at the counter',
            self::Online => 'Pay online (GCash or card)',
```

- [ ] **Step 5: Write the migration**

`database/migrations/2026_09_23_010000_create_payments_table.php`:

```php
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
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 20);
            $table->string('provider_reference')->nullable()->unique();
            $table->string('provider_payment_id')->nullable();
            $table->string('method', 20)->nullable();
            $table->unsignedInteger('amount');
            $table->string('state', 10)->default('pending');
            $table->text('checkout_url')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['order_id', 'state']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
```

- [ ] **Step 6: Write the model and factory**

`app/Models/Payment.php`:

```php
<?php

namespace App\Models;

use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use Database\Factories\PaymentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One attempt to pay an order. Retries add rows; nothing is ever overwritten,
 * so the history of a payment is readable long after the meal.
 *
 * @property int $id
 * @property int $order_id
 * @property PaymentProvider $provider
 * @property string|null $provider_reference
 * @property string|null $provider_payment_id
 * @property string|null $method
 * @property int $amount
 * @property PaymentState $state
 * @property string|null $checkout_url
 * @property Carbon|null $paid_at
 * @property int|null $received_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Order $order
 * @property-read User|null $receiver
 */
#[Fillable([
    'provider',
    'provider_reference',
    'provider_payment_id',
    'method',
    'amount',
    'state',
    'checkout_url',
    'paid_at',
    'received_by',
])]
class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'provider_reference' => null,
        'provider_payment_id' => null,
        'method' => null,
        'state' => 'pending',
        'checkout_url' => null,
        'paid_at' => null,
        'received_by' => null,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'provider' => PaymentProvider::class,
            'state' => PaymentState::class,
            'amount' => 'integer',
            'paid_at' => 'datetime',
        ];
    }

    /**
     * The order being paid.
     *
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * The staff member who took the payment at the counter.
     *
     * @return BelongsTo<User, $this>
     */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
```

`database/factories/PaymentFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'provider' => PaymentProvider::PayMongo,
            'provider_reference' => 'cs_'.Str::lower(Str::random(24)),
            'method' => null,
            'amount' => 36000,
            'state' => PaymentState::Pending,
            'checkout_url' => 'https://checkout.paymongo.com/'.Str::lower(Str::random(20)),
            'paid_at' => null,
            'received_by' => null,
        ];
    }

    /**
     * Money handed over at the counter: no provider, no reference.
     */
    public function counter(): static
    {
        return $this->state(fn (): array => [
            'provider' => PaymentProvider::Counter,
            'provider_reference' => null,
            'method' => 'counter',
            'state' => PaymentState::Paid,
            'checkout_url' => null,
            'paid_at' => now(),
        ]);
    }

    /**
     * An online attempt that went through.
     */
    public function paid(): static
    {
        return $this->state(fn (): array => [
            'state' => PaymentState::Paid,
            'method' => 'gcash',
            'provider_payment_id' => 'pay_'.Str::lower(Str::random(24)),
            'paid_at' => now(),
        ]);
    }
}
```

- [ ] **Step 7: Add the relations to `app/Models/Order.php`**

```php
    /**
     * Every attempt to pay this order, newest first.
     *
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->latest('id');
    }

    /**
     * The attempt that matters right now.
     */
    public function latestPayment(): ?Payment
    {
        return $this->payments()->first();
    }
```

and add `@property-read Collection<int, Payment> $payments` to the class docblock.

- [ ] **Step 8: Ask the user to migrate**

Tell the user to run:

```bash
php artisan migrate
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Payments/PaymentModelTest.php`
Expected: PASS (3 tests).

Run: `vendor/bin/pint --dirty --format agent`

---

### Task 2: The PayMongo client

**Files:**

- Create: `app/Services/PayMongoClient.php`
- Test: `tests/Feature/Payments/PayMongoClientTest.php`

**Interfaces:**

- Produces: `PayMongoClient::enabled(): bool`, `createCheckoutSession(Order $order, string $successUrl, string $cancelUrl): ?array` returning `['id' => string, 'checkout_url' => string]` or `null` when PayMongo refuses, and `checkoutSession(string $id): ?array` returning the session's `attributes` array or `null`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Payments/PayMongoClientTest.php`:

```php
<?php

use App\Models\MenuItem;
use App\Models\MenuItemSize;
use App\Models\Order;
use App\Models\OrderItem;
use App\Services\PayMongoClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config()->set('paymongo.secret_key', 'sk_test_secret');
    config()->set('paymongo.methods', ['gcash', 'card']);
});

function orderWithLines(): Order
{
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    OrderItem::factory()->for($order)->create([
        'item_name' => 'Adobo',
        'size_name' => 'Large',
        'unit_price' => 18000,
        'quantity' => 2,
        'line_total' => 36000,
    ]);

    return $order->load('items');
}

test('a checkout session is created with the order priced in centavos', function () {
    Http::fake([
        'api.paymongo.com/v1/checkout_sessions' => Http::response([
            'data' => [
                'id' => 'cs_abc123',
                'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/cs_abc123'],
            ],
        ], 200),
    ]);

    $order = orderWithLines();

    $session = app(PayMongoClient::class)->createCheckoutSession(
        $order,
        'https://bistro.test/order/'.$order->token.'?paid=1',
        'https://bistro.test/order/'.$order->token,
    );

    expect($session)->toBe([
        'id' => 'cs_abc123',
        'checkout_url' => 'https://checkout.paymongo.com/cs_abc123',
    ]);

    Http::assertSent(function (Request $request) use ($order): bool {
        $body = $request->data();
        $attributes = $body['data']['attributes'];

        return $request->hasHeader('Authorization', 'Basic '.base64_encode('sk_test_secret:'))
            && $attributes['payment_method_types'] === ['gcash', 'card']
            && $attributes['line_items'][0]['amount'] === 18000
            && $attributes['line_items'][0]['quantity'] === 2
            && $attributes['line_items'][0]['currency'] === 'PHP'
            && $attributes['reference_number'] === $order->order_number
            && $attributes['metadata']['order_token'] === $order->token;
    });
});

test('a refusal from paymongo is reported as nothing, not an exception', function () {
    Http::fake([
        'api.paymongo.com/*' => Http::response(['errors' => [['detail' => 'Amount too small']]], 400),
    ]);

    expect(app(PayMongoClient::class)->createCheckoutSession(orderWithLines(), 'https://a', 'https://b'))
        ->toBeNull();
});

test('a session is read back by id', function () {
    Http::fake([
        'api.paymongo.com/v1/checkout_sessions/cs_abc123' => Http::response([
            'data' => [
                'id' => 'cs_abc123',
                'attributes' => [
                    'payments' => [[
                        'id' => 'pay_1',
                        'attributes' => ['status' => 'paid', 'amount' => 36000, 'source' => ['type' => 'gcash']],
                    ]],
                ],
            ],
        ], 200),
    ]);

    $attributes = app(PayMongoClient::class)->checkoutSession('cs_abc123');

    expect($attributes['payments'][0]['attributes']['status'])->toBe('paid');
});

test('without a key the client is switched off', function () {
    config()->set('paymongo.secret_key', '');
    Http::fake();

    $client = app(PayMongoClient::class);

    expect($client->enabled())->toBeFalse()
        ->and($client->createCheckoutSession(orderWithLines(), 'https://a', 'https://b'))->toBeNull();

    Http::assertNothingSent();
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Payments/PayMongoClientTest.php`
Expected: FAIL — `Class "App\Services\PayMongoClient" not found`.

- [ ] **Step 3: Write `app/Services/PayMongoClient.php`**

```php
<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The only place in the app that talks to PayMongo. Everything it returns is
 * treated as a claim to be checked, never as an instruction.
 */
class PayMongoClient
{
    /**
     * Whether a secret key is configured at all.
     */
    public function enabled(): bool
    {
        return $this->secret() !== '';
    }

    /**
     * Open a hosted checkout for an order.
     *
     * @return array{id: string, checkout_url: string}|null  null when PayMongo refuses
     */
    public function createCheckoutSession(Order $order, string $successUrl, string $cancelUrl): ?array
    {
        if (! $this->enabled()) {
            return null;
        }

        $response = $this->request()->post('/checkout_sessions', [
            'data' => [
                'attributes' => [
                    'line_items' => $this->lineItems($order),
                    'payment_method_types' => $this->methods(),
                    'success_url' => $successUrl,
                    'cancel_url' => $cancelUrl,
                    'description' => 'Order '.$order->order_number,
                    'reference_number' => $order->order_number,
                    'send_email_receipt' => false,
                    'show_description' => true,
                    'show_line_items' => true,
                    'metadata' => [
                        'order_token' => $order->token,
                        'order_number' => $order->order_number,
                    ],
                ],
            ],
        ]);

        if ($response->failed()) {
            Log::warning('paymongo.checkout_session_failed', [
                'order' => $order->order_number,
                'status' => $response->status(),
            ]);

            return null;
        }

        $id = $response->json('data.id');
        $url = $response->json('data.attributes.checkout_url');

        if (! is_string($id) || ! is_string($url)) {
            Log::warning('paymongo.checkout_session_malformed', ['order' => $order->order_number]);

            return null;
        }

        return ['id' => $id, 'checkout_url' => $url];
    }

    /**
     * Read a session back from PayMongo. This, not the guest's browser, is what
     * decides whether an order was paid.
     *
     * @return array<string, mixed>|null
     */
    public function checkoutSession(string $id): ?array
    {
        if (! $this->enabled()) {
            return null;
        }

        $response = $this->request()->get('/checkout_sessions/'.$id);

        if ($response->failed()) {
            Log::warning('paymongo.checkout_session_read_failed', [
                'reference' => $id,
                'status' => $response->status(),
            ]);

            return null;
        }

        $attributes = $response->json('data.attributes');

        return is_array($attributes) ? $attributes : null;
    }

    private function request(): PendingRequest
    {
        return Http::baseUrl($this->baseUrl())
            ->withBasicAuth($this->secret(), '')
            ->acceptJson()
            ->asJson()
            ->timeout(15)
            ->connectTimeout(5)
            ->retry(2, 250, throw: false);
    }

    /**
     * The order's own lines, so the guest sees on PayMongo what they ordered.
     *
     * @return array<int, array{name: string, amount: int, currency: string, quantity: int}>
     */
    private function lineItems(Order $order): array
    {
        return $order->items
            ->map(fn (OrderItem $item): array => [
                'name' => $item->item_name.' ('.$item->size_name.')',
                'amount' => $item->unit_price,
                'currency' => 'PHP',
                'quantity' => $item->quantity,
            ])
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function methods(): array
    {
        $methods = config('paymongo.methods');

        return is_array($methods) && $methods !== [] ? array_values($methods) : ['gcash'];
    }

    private function secret(): string
    {
        return (string) config('paymongo.secret_key');
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('paymongo.base_url'), '/');
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Payments/PayMongoClientTest.php`
Expected: PASS (4 tests).

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`

---

### Task 3: Starting an online payment

**Files:**

- Create: `app/Http/Controllers/CheckoutOptionsController.php`
- Create: `app/Http/Controllers/OrderPaymentController.php` (the `session` action only in this task)
- Create: `app/Http/Resources/PaymentResource.php`
- Modify: `app/Http/Requests/PlaceOrderRequest.php` (accept `online` only while it is enabled)
- Modify: `routes/api.php`, `app/Providers/AppServiceProvider.php` (the `payments` limiter)
- Test: `tests/Feature/Payments/CheckoutSessionTest.php`, `tests/Feature/Payments/CheckoutOptionsTest.php`

**Interfaces:**

- Consumes: `PayMongoClient` from Task 2.
- Produces: `GET /api/v1/checkout/options` → `{"data": {"tables": 20, "methods": ["counter","online"], "online_minimum": 10000}}`; `POST /api/v1/orders/{token}/checkout-session` → 201 `{"data": {"checkout_url": "...", "state": "pending", "amount": 36000}}`, 422 when the order cannot be paid online, 503 when PayMongo is off or refuses.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Payments/CheckoutOptionsTest.php`:

```php
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
```

`tests/Feature/Payments/CheckoutSessionTest.php`:

```php
<?php

use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config()->set('paymongo.secret_key', 'sk_test_secret');

    Http::fake([
        'api.paymongo.com/v1/checkout_sessions' => Http::response([
            'data' => [
                'id' => 'cs_abc123',
                'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/cs_abc123'],
            ],
        ], 200),
    ]);
});

function payableOrder(int $total = 36000): Order
{
    $order = Order::factory()->create(['subtotal' => $total, 'total' => $total]);
    OrderItem::factory()->for($order)->create([
        'item_name' => 'Adobo',
        'size_name' => 'Large',
        'unit_price' => $total,
        'quantity' => 1,
        'line_total' => $total,
    ]);

    return $order;
}

test('a guest starts an online payment and gets a checkout url', function () {
    $order = payableOrder();

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")
        ->assertCreated()
        ->assertJsonPath('data.checkout_url', 'https://checkout.paymongo.com/cs_abc123')
        ->assertJsonPath('data.state', 'pending');

    $payment = $order->payments()->sole();

    expect($payment->provider)->toBe(PaymentProvider::PayMongo)
        ->and($payment->provider_reference)->toBe('cs_abc123')
        ->and($payment->amount)->toBe(36000)
        ->and($payment->state)->toBe(PaymentState::Pending)
        ->and($order->fresh()->payment_method->value)->toBe('online')
        ->and($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid);
});

test('a second attempt is its own row, so the history stays readable', function () {
    $order = payableOrder();

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")->assertCreated();

    Http::fake([
        'api.paymongo.com/v1/checkout_sessions' => Http::response([
            'data' => [
                'id' => 'cs_second',
                'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/cs_second'],
            ],
        ], 200),
    ]);

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")->assertCreated();

    expect($order->payments()->count())->toBe(2);
});

test('an order that is already paid or cancelled cannot be paid again', function () {
    $paid = payableOrder();
    $paid->payment_status = PaymentStatus::Paid;
    $paid->save();

    $cancelled = payableOrder();
    $cancelled->status = App\Enums\OrderStatus::Cancelled;
    $cancelled->save();

    $this->postJson("/api/v1/orders/{$paid->token}/checkout-session")->assertStatus(422);
    $this->postJson("/api/v1/orders/{$cancelled->token}/checkout-session")->assertStatus(422);

    expect($paid->payments()->count())->toBe(0);
});

test('a small order is sent to the counter instead', function () {
    config()->set('paymongo.minimum_amount', 10000);

    $order = payableOrder(5000);

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")
        ->assertStatus(422)
        ->assertJsonPath('code', 'below_online_minimum');
});

test('with no key at all the guest is told to pay at the counter', function () {
    config()->set('paymongo.secret_key', '');

    $order = payableOrder();

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")
        ->assertStatus(503)
        ->assertJsonPath('code', 'online_payment_unavailable');
});

test('starting payments is rate limited', function () {
    $order = payableOrder();

    foreach (range(1, 10) as $attempt) {
        Http::fake([
            'api.paymongo.com/v1/checkout_sessions' => Http::response([
                'data' => [
                    'id' => 'cs_'.$attempt,
                    'attributes' => ['checkout_url' => 'https://checkout.paymongo.com/cs_'.$attempt],
                ],
            ], 200),
        ]);

        $this->postJson("/api/v1/orders/{$order->token}/checkout-session")->assertCreated();
    }

    $this->postJson("/api/v1/orders/{$order->token}/checkout-session")->assertTooManyRequests();
});
```

- [ ] **Step 2: Run the tests to watch them fail**

Run: `php artisan test --compact tests/Feature/Payments`
Expected: FAIL — 404 on both new routes.

- [ ] **Step 3: Write `app/Http/Controllers/CheckoutOptionsController.php`**

```php
<?php

namespace App\Http\Controllers;

use App\Services\PayMongoClient;
use Illuminate\Http\JsonResponse;

class CheckoutOptionsController extends Controller
{
    /**
     * What the cart may offer a guest: how high table numbers go, which ways
     * they can pay, and the smallest order PayMongo will take.
     */
    public function __invoke(PayMongoClient $paymongo): JsonResponse
    {
        $methods = ['counter'];

        if ($paymongo->enabled()) {
            $methods[] = 'online';
        }

        return response()->json([
            'data' => [
                'tables' => (int) config('restaurant.tables'),
                'methods' => $methods,
                'online_minimum' => (int) config('paymongo.minimum_amount'),
            ],
        ]);
    }
}
```

- [ ] **Step 4: Write `app/Http/Resources/PaymentResource.php`**

```php
<?php

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * What a guest may know about an attempt: where to pay, how much, and how it
 * ended. Provider ids stay on the server.
 *
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'checkout_url' => $this->checkout_url,
            'amount' => $this->amount,
            'state' => $this->state->value,
            'method' => $this->method,
            'paid_at' => $this->paid_at?->toIso8601String(),
        ];
    }
}
```

- [ ] **Step 5: Write `app/Http/Controllers/OrderPaymentController.php`**

```php
<?php

namespace App\Http\Controllers;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Http\Resources\PaymentResource;
use App\Models\Order;
use App\Models\Payment;
use App\Services\PayMongoClient;
use Illuminate\Http\JsonResponse;

class OrderPaymentController extends Controller
{
    /**
     * Open a PayMongo checkout for an order. Every attempt is its own row, so a
     * guest who gives up and tries again leaves a readable trail.
     */
    public function session(Order $order, PayMongoClient $paymongo): JsonResponse
    {
        if ($order->payment_status === PaymentStatus::Paid || $order->status === OrderStatus::Cancelled) {
            return response()->json([
                'message' => 'This order cannot be paid online any more.',
                'code' => 'order_not_payable',
            ], 422);
        }

        if (! $paymongo->enabled()) {
            return response()->json([
                'message' => 'Online payment is not available right now. Please pay at the counter.',
                'code' => 'online_payment_unavailable',
            ], 503);
        }

        if ($order->total < (int) config('paymongo.minimum_amount')) {
            return response()->json([
                'message' => 'This order is too small to pay online. Please pay at the counter.',
                'code' => 'below_online_minimum',
            ], 422);
        }

        $session = $paymongo->createCheckoutSession(
            $order->load('items'),
            url('/order/'.$order->token.'?paid=1'),
            url('/order/'.$order->token),
        );

        if ($session === null) {
            return response()->json([
                'message' => 'We could not reach the payment provider. Please try again or pay at the counter.',
                'code' => 'online_payment_unavailable',
            ], 503);
        }

        $payment = $order->payments()->create([
            'provider' => PaymentProvider::PayMongo,
            'provider_reference' => $session['id'],
            'amount' => $order->total,
            'checkout_url' => $session['checkout_url'],
        ]);

        $order->payment_method = PaymentMethod::Online;
        $order->save();

        return PaymentResource::make($payment)->response()->setStatusCode(201);
    }
}
```

- [ ] **Step 6: Let `PlaceOrderRequest` accept `online`, but only when it is on**

Replace the `payment_method` rule with:

```php
            'payment_method' => [
                'required',
                Rule::enum(PaymentMethod::class)->only($this->allowedMethods()),
            ],
```

and add:

```php
    /**
     * Online payment is only offered while PayMongo is configured.
     *
     * @return array<int, PaymentMethod>
     */
    private function allowedMethods(): array
    {
        $methods = [PaymentMethod::Counter];

        if (app(PayMongoClient::class)->enabled()) {
            $methods[] = PaymentMethod::Online;
        }

        return $methods;
    }
```

with `use App\Services\PayMongoClient;` added to the imports.

- [ ] **Step 7: Add the routes and the limiter**

In `routes/api.php`:

```php
Route::get('/checkout/options', CheckoutOptionsController::class)->name('checkout.options');

Route::post('/orders/{order}/checkout-session', [OrderPaymentController::class, 'session'])
    ->middleware('throttle:payments')
    ->name('orders.payment.session');
```

In `configureRateLimiting()`:

```php
        // Starting a payment costs us a provider call, so it is held tighter
        // than ordinary reads. Ten is generous for one guest and cheap for us.
        RateLimiter::for('payments', function (Request $request): array {
            $limits = [Limit::perMinute(10)->by('ip:'.$request->ip())];

            if ($request->hasSession()) {
                $limits[] = Limit::perMinute(10)->by('device:'.$request->session()->getId());
            }

            return $limits;
        });
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `php artisan test --compact tests/Feature/Payments`
Expected: PASS.

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`

---

### Task 4: `PaymentConfirmer` and the return path

**Files:**

- Create: `app/Services/PaymentConfirmer.php`
- Modify: `app/Http/Controllers/OrderPaymentController.php` (add `refresh`)
- Modify: `routes/api.php`
- Test: `tests/Feature/Payments/PaymentRefreshTest.php`

**Interfaces:**

- Consumes: `PayMongoClient::checkoutSession()`, `Payment`, `Order`.
- Produces: `PaymentConfirmer::confirmOnline(Payment $payment, array $session): bool` (idempotent, refuses on a wrong amount) and `confirmAtCounter(Order $order, User $cashier): Payment` (throws `ValidationException` on a paid or cancelled order); `POST /api/v1/orders/{token}/payment/refresh` returning the order as `OrderResource`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Payments/PaymentRefreshTest.php`:

```php
<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentState;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config()->set('paymongo.secret_key', 'sk_test_secret');
});

function fakeSession(string $id, string $status, int $amount): void
{
    Http::fake([
        "api.paymongo.com/v1/checkout_sessions/{$id}" => Http::response([
            'data' => [
                'id' => $id,
                'attributes' => [
                    'payments' => [[
                        'id' => 'pay_123',
                        'attributes' => [
                            'status' => $status,
                            'amount' => $amount,
                            'source' => ['type' => 'gcash'],
                        ],
                    ]],
                ],
            ],
        ], 200),
    ]);
}

test('a paid session confirms the order and moves it to the kitchen', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    $payment = Payment::factory()->for($order)->create([
        'provider_reference' => 'cs_paid',
        'amount' => 36000,
    ]);

    fakeSession('cs_paid', 'paid', 36000);

    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid')
        ->assertJsonPath('data.status', 'confirmed');

    $payment->refresh();

    expect($payment->state)->toBe(PaymentState::Paid)
        ->and($payment->method)->toBe('gcash')
        ->and($payment->provider_payment_id)->toBe('pay_123')
        ->and($payment->paid_at)->not->toBeNull()
        ->and(AuditLog::query()->where('action', 'order.paid')->count())->toBe(1);
});

test('an unpaid session changes nothing', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_open', 'amount' => 36000]);

    fakeSession('cs_open', 'awaiting_payment_method', 36000);

    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'unpaid')
        ->assertJsonPath('data.status', 'pending');

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid);
});

test('a payment for the wrong amount is refused and written down', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_short', 'amount' => 36000]);

    fakeSession('cs_short', 'paid', 100);

    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")->assertOk();

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid)
        ->and(AuditLog::query()->where('action', 'payment.amount_mismatch')->count())->toBe(1);
});

test('confirming twice pays the order once', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_twice', 'amount' => 36000]);

    fakeSession('cs_twice', 'paid', 36000);

    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")->assertOk();
    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")->assertOk();

    expect($order->payments()->where('state', PaymentState::Paid)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'order.paid')->count())->toBe(1);
});

test('an order already being cooked is not dragged back to confirmed', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    $order->status = OrderStatus::Preparing;
    $order->save();

    Payment::factory()->for($order)->create(['provider_reference' => 'cs_cooking', 'amount' => 36000]);

    fakeSession('cs_cooking', 'paid', 36000);

    $this->postJson("/api/v1/orders/{$order->token}/payment/refresh")->assertOk();

    expect($order->fresh()->status)->toBe(OrderStatus::Preparing)
        ->and($order->fresh()->payment_status)->toBe(PaymentStatus::Paid);
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Payments/PaymentRefreshTest.php`
Expected: FAIL — 404, the refresh route does not exist.

- [ ] **Step 3: Write `app/Services/PaymentConfirmer.php`**

```php
<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentProvider;
use App\Enums\PaymentState;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The only place that writes `paid`. Both the webhook and the guest's return
 * come through here, and both hand over what PayMongo itself said — never what
 * a browser claimed.
 */
class PaymentConfirmer
{
    /**
     * Settle an online attempt against a checkout session read from PayMongo.
     *
     * @param  array<string, mixed>  $session  the session's `attributes`
     * @return bool  whether the order is paid once this returns
     */
    public function confirmOnline(Payment $payment, array $session): bool
    {
        if ($payment->state === PaymentState::Paid) {
            return true;
        }

        $paid = null;

        foreach ((array) data_get($session, 'payments', []) as $entry) {
            if (data_get($entry, 'attributes.status') === 'paid') {
                $paid = $entry;

                break;
            }
        }

        if ($paid === null) {
            return false;
        }

        $order = $payment->order;
        $amount = (int) data_get($paid, 'attributes.amount');

        if ($amount !== $order->total) {
            AuditLog::record('payment.amount_mismatch', $order, context: [
                'expected' => $order->total,
                'received' => $amount,
                'reference' => $payment->provider_reference,
            ]);

            return false;
        }

        DB::transaction(function () use ($payment, $order, $paid, $amount): void {
            $payment->fill([
                'state' => PaymentState::Paid,
                'method' => (string) data_get($paid, 'attributes.source.type', 'online'),
                'provider_payment_id' => (string) data_get($paid, 'id'),
                'paid_at' => now(),
            ])->save();

            $this->markOrderPaid($order, PaymentMethod::Online);

            AuditLog::record('order.paid', $order, context: [
                'provider' => PaymentProvider::PayMongo->value,
                'amount' => $amount,
                'reference' => $payment->provider_reference,
            ]);
        });

        return true;
    }

    /**
     * Record money handed over at the counter.
     *
     * @throws ValidationException
     */
    public function confirmAtCounter(Order $order, User $cashier): Payment
    {
        if ($order->payment_status === PaymentStatus::Paid) {
            throw ValidationException::withMessages(['order' => 'This order is already paid.']);
        }

        if ($order->status === OrderStatus::Cancelled) {
            throw ValidationException::withMessages(['order' => 'This order was cancelled.']);
        }

        return DB::transaction(function () use ($order, $cashier): Payment {
            $payment = $order->payments()->create([
                'provider' => PaymentProvider::Counter,
                'method' => 'counter',
                'amount' => $order->total,
                'state' => PaymentState::Paid,
                'paid_at' => now(),
                'received_by' => $cashier->getAuthIdentifier(),
            ]);

            $this->markOrderPaid($order, PaymentMethod::Counter);

            AuditLog::record('order.paid', $order, $cashier, [
                'provider' => PaymentProvider::Counter->value,
                'amount' => $order->total,
            ]);

            return $payment;
        });
    }

    /**
     * Paying lifts a waiting order to confirmed, and leaves a cooking one alone.
     */
    private function markOrderPaid(Order $order, PaymentMethod $method): void
    {
        $order->payment_status = PaymentStatus::Paid;
        $order->payment_method = $method;

        if ($order->status === OrderStatus::Pending) {
            $order->status = OrderStatus::Confirmed;
        }

        $order->save();
    }
}
```

- [ ] **Step 4: Add `refresh` to `app/Http/Controllers/OrderPaymentController.php`**

```php
    /**
     * The guest is back from PayMongo. Their browser's word means nothing here:
     * the server asks PayMongo directly how the session ended.
     */
    public function refresh(Order $order, PayMongoClient $paymongo, PaymentConfirmer $confirmer): OrderResource
    {
        $payment = $order->payments()
            ->where('provider', PaymentProvider::PayMongo)
            ->whereNotNull('provider_reference')
            ->first();

        if ($payment !== null && $payment->state !== PaymentState::Paid) {
            $session = $paymongo->checkoutSession((string) $payment->provider_reference);

            if ($session !== null) {
                $confirmer->confirmOnline($payment, $session);
            }
        }

        return OrderResource::make($order->refresh()->load('items'));
    }
```

with `use App\Enums\PaymentState;`, `use App\Http\Resources\OrderResource;` and `use App\Services\PaymentConfirmer;` added to the imports.

- [ ] **Step 5: Add the route**

In `routes/api.php`, beside the checkout-session route:

```php
Route::post('/orders/{order}/payment/refresh', [OrderPaymentController::class, 'refresh'])
    ->middleware('throttle:payments')
    ->name('orders.payment.refresh');
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Payments/PaymentRefreshTest.php`
Expected: PASS (5 tests).

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`

---

### Task 5: The signed webhook

**Files:**

- Create: `app/Http/Middleware/VerifyPayMongoSignature.php`
- Create: `app/Http/Controllers/PayMongoWebhookController.php`
- Modify: `bootstrap/app.php` (alias `paymongo.signature`), `routes/api.php`
- Test: `tests/Feature/Payments/PayMongoWebhookTest.php`

**Interfaces:**

- Consumes: `PayMongoClient::checkoutSession()`, `PaymentConfirmer::confirmOnline()`.
- Produces: `POST /api/v1/webhooks/paymongo`, 400 on a bad or stale signature, 200 `{"received": true}` otherwise — including for events about somebody else's payment.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Payments/PayMongoWebhookTest.php`:

```php
<?php

use App\Enums\PaymentState;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    config()->set('paymongo.secret_key', 'sk_test_secret');
    config()->set('paymongo.webhook_secret', 'whsk_test_secret');
});

function webhookPayload(string $reference, string $type = 'checkout_session.payment.paid'): array
{
    return [
        'data' => [
            'id' => 'evt_1',
            'attributes' => [
                'type' => $type,
                'livemode' => false,
                'data' => [
                    'id' => $reference,
                    'attributes' => ['metadata' => ['order_token' => 'unused']],
                ],
            ],
        ],
    ];
}

/**
 * Post a webhook the way PayMongo does: a raw JSON body with a signature over
 * "timestamp.body".
 */
function postWebhook(array $payload, ?int $timestamp = null, string $secret = 'whsk_test_secret'): TestResponse
{
    $body = json_encode($payload, JSON_THROW_ON_ERROR);
    $timestamp ??= time();
    $signature = hash_hmac('sha256', $timestamp.'.'.$body, $secret);

    return test()->call(
        'POST',
        '/api/v1/webhooks/paymongo',
        [],
        [],
        [],
        [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_PAYMONGO_SIGNATURE' => "t={$timestamp},te={$signature},li=",
        ],
        $body,
    );
}

function paidSession(string $id, int $amount = 36000): void
{
    Http::fake([
        "api.paymongo.com/v1/checkout_sessions/{$id}" => Http::response([
            'data' => [
                'id' => $id,
                'attributes' => [
                    'payments' => [[
                        'id' => 'pay_hook',
                        'attributes' => ['status' => 'paid', 'amount' => $amount, 'source' => ['type' => 'card']],
                    ]],
                ],
            ],
        ], 200),
    ]);
}

test('a signed event pays the order', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_hook', 'amount' => 36000]);
    paidSession('cs_hook');

    postWebhook(webhookPayload('cs_hook'))->assertOk()->assertJsonPath('received', true);

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Paid)
        ->and($order->fresh()->status->value)->toBe('confirmed')
        ->and($order->payments()->sole()->method)->toBe('card');
});

test('an unsigned or wrongly signed event changes nothing', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_hook', 'amount' => 36000]);
    paidSession('cs_hook');

    postWebhook(webhookPayload('cs_hook'), secret: 'whsk_wrong')->assertStatus(400);

    $this->postJson('/api/v1/webhooks/paymongo', webhookPayload('cs_hook'))->assertStatus(400);

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid);
});

test('an old signature is treated as a replay', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_hook', 'amount' => 36000]);
    paidSession('cs_hook');

    postWebhook(webhookPayload('cs_hook'), timestamp: time() - 3600)->assertStatus(400);

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid);
});

test('the same event twice pays once', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_hook', 'amount' => 36000]);
    paidSession('cs_hook');

    postWebhook(webhookPayload('cs_hook'))->assertOk();
    postWebhook(webhookPayload('cs_hook'))->assertOk();

    expect($order->payments()->where('state', PaymentState::Paid)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'order.paid')->count())->toBe(1);
});

test('an event about a payment we never started is accepted and ignored', function () {
    Http::fake();

    postWebhook(webhookPayload('cs_someone_else'))->assertOk();

    expect(Payment::query()->count())->toBe(0);
    Http::assertNothingSent();
});

test('a payment.paid event finds the order through its metadata', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    Payment::factory()->for($order)->create(['provider_reference' => 'cs_meta', 'amount' => 36000]);
    paidSession('cs_meta');

    $payload = [
        'data' => [
            'id' => 'evt_2',
            'attributes' => [
                'type' => 'payment.paid',
                'data' => [
                    'id' => 'pay_meta',
                    'attributes' => ['metadata' => ['order_token' => $order->token]],
                ],
            ],
        ],
    ];

    postWebhook($payload)->assertOk();

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Paid);
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Payments/PayMongoWebhookTest.php`
Expected: FAIL — 404, no webhook route.

- [ ] **Step 3: Write `app/Http/Middleware/VerifyPayMongoSignature.php`**

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * PayMongo signs every event with the endpoint's webhook secret. Anything that
 * does not carry a fresh, matching signature is discarded: PayMongo did not
 * send it.
 */
class VerifyPayMongoSignature
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('paymongo.webhook_secret');

        if ($secret === '' || ! $this->verified($request, $secret)) {
            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        return $next($request);
    }

    /**
     * The signed string is "<timestamp>.<raw body>", hashed with HMAC-SHA256.
     */
    private function verified(Request $request, string $secret): bool
    {
        $parts = $this->parse((string) $request->header('Paymongo-Signature', ''));
        $timestamp = $parts['t'] ?? '';

        if (! ctype_digit($timestamp)) {
            return false;
        }

        $tolerance = (int) config('paymongo.signature_tolerance');

        if (abs(time() - (int) $timestamp) > $tolerance) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp.'.'.$request->getContent(), $secret);

        foreach (['te', 'li'] as $mode) {
            $given = $parts[$mode] ?? '';

            if ($given !== '' && hash_equals($expected, $given)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Read "t=...,te=...,li=..." into its parts.
     *
     * @return array<string, string>
     */
    private function parse(string $header): array
    {
        $parts = [];

        foreach (explode(',', $header) as $piece) {
            [$key, $value] = array_pad(explode('=', trim($piece), 2), 2, '');
            $parts[$key] = $value;
        }

        return $parts;
    }
}
```

- [ ] **Step 4: Write `app/Http/Controllers/PayMongoWebhookController.php`**

```php
<?php

namespace App\Http\Controllers;

use App\Enums\PaymentProvider;
use App\Models\Payment;
use App\Services\PaymentConfirmer;
use App\Services\PayMongoClient;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayMongoWebhookController extends Controller
{
    /**
     * A signed event only tells us *where to look*. What actually happened is
     * read back from PayMongo, so a forged body can never pay an order.
     */
    public function __invoke(Request $request, PayMongoClient $paymongo, PaymentConfirmer $confirmer): JsonResponse
    {
        $reference = $request->input('data.attributes.data.id');
        $token = $request->input('data.attributes.data.attributes.metadata.order_token');

        $payment = $this->findPayment(
            is_string($reference) ? $reference : null,
            is_string($token) ? $token : null,
        );

        if ($payment !== null && $payment->provider_reference !== null) {
            $session = $paymongo->checkoutSession($payment->provider_reference);

            if ($session !== null) {
                $confirmer->confirmOnline($payment, $session);
            }
        }

        return response()->json(['received' => true]);
    }

    /**
     * Match the event to an attempt of ours, by its checkout session or by the
     * order token we sent along as metadata.
     */
    private function findPayment(?string $reference, ?string $token): ?Payment
    {
        $payment = $reference === null
            ? null
            : Payment::query()->where('provider_reference', $reference)->first();

        if ($payment !== null || $token === null) {
            return $payment;
        }

        return Payment::query()
            ->where('provider', PaymentProvider::PayMongo)
            ->whereHas('order', fn (Builder $query) => $query->where('token', $token))
            ->latest('id')
            ->first();
    }
}
```

- [ ] **Step 5: Register the alias and the route**

In `bootstrap/app.php`, in the alias list:

```php
            'paymongo.signature' => VerifyPayMongoSignature::class,
```

with `use App\Http\Middleware\VerifyPayMongoSignature;` at the top.

In `routes/api.php`:

```php
Route::post('/webhooks/paymongo', PayMongoWebhookController::class)
    ->middleware('paymongo.signature')
    ->name('webhooks.paymongo');
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Payments/PayMongoWebhookTest.php`
Expected: PASS (6 tests).

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`

---

### Task 6: "Mark as Paid" for the counter

**Files:**

- Create: `app/Policies/OrderPolicy.php`
- Create: `app/Http/Controllers/Admin/MarkOrderPaidController.php`
- Modify: `app/Http/Controllers/CurrentUserController.php` (the `mark_paid` ability)
- Modify: `routes/api.php`
- Test: `tests/Feature/Payments/MarkPaidTest.php`

**Interfaces:**

- Consumes: `PaymentConfirmer::confirmAtCounter()`.
- Produces: `OrderPolicy::markPaid(User $user): bool` (Admin and Cashier); `POST /api/v1/orders/{token}/mark-paid` returning the updated `OrderResource`; the `mark_paid` ability on `GET /me`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Payments/MarkPaidTest.php`:

```php
<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\User;

test('a cashier records the money handed over at the counter', function () {
    $cashier = User::factory()->cashier()->create();
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);

    $this->actingAs($cashier)
        ->postJson("/api/v1/orders/{$order->token}/mark-paid")
        ->assertOk()
        ->assertJsonPath('data.payment_status', 'paid')
        ->assertJsonPath('data.status', 'confirmed')
        ->assertJsonPath('data.payment_method', 'counter');

    $payment = $order->payments()->sole();

    expect($payment->provider)->toBe(PaymentProvider::Counter)
        ->and($payment->amount)->toBe(36000)
        ->and($payment->received_by)->toBe($cashier->id)
        ->and(AuditLog::query()->where('action', 'order.paid')->where('causer_id', $cashier->id)->count())->toBe(1);
});

test('the kitchen cannot take money and a guest cannot either', function () {
    $order = Order::factory()->create();

    $this->postJson("/api/v1/orders/{$order->token}/mark-paid")->assertUnauthorized();

    $this->actingAs(User::factory()->kitchen()->create())
        ->postJson("/api/v1/orders/{$order->token}/mark-paid")
        ->assertForbidden();

    expect($order->payments()->count())->toBe(0)
        ->and($order->fresh()->payment_status)->toBe(PaymentStatus::Unpaid);
});

test('an admin may take payment too', function () {
    $order = Order::factory()->create(['subtotal' => 10000, 'total' => 10000]);

    $this->actingAs(User::factory()->admin()->create())
        ->postJson("/api/v1/orders/{$order->token}/mark-paid")
        ->assertOk();

    expect($order->fresh()->payment_status)->toBe(PaymentStatus::Paid);
});

test('an order cannot be paid twice, and a cancelled one not at all', function () {
    $cashier = User::factory()->cashier()->create();

    $paid = Order::factory()->create(['subtotal' => 10000, 'total' => 10000]);
    $this->actingAs($cashier)->postJson("/api/v1/orders/{$paid->token}/mark-paid")->assertOk();
    $this->actingAs($cashier)->postJson("/api/v1/orders/{$paid->token}/mark-paid")->assertStatus(422);

    $cancelled = Order::factory()->create();
    $cancelled->status = OrderStatus::Cancelled;
    $cancelled->save();

    $this->actingAs($cashier)->postJson("/api/v1/orders/{$cancelled->token}/mark-paid")->assertStatus(422);

    expect($paid->payments()->count())->toBe(1)
        ->and($cancelled->payments()->count())->toBe(0);
});

test('the signed-in cashier is told they may take payments', function () {
    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('abilities.mark_paid', true);

    $this->actingAs(User::factory()->kitchen()->create())
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('abilities.mark_paid', false);
});
```

(Check `database/factories/UserFactory.php` for the exact role state names — use whatever it already defines for admin, cashier and kitchen.)

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Payments/MarkPaidTest.php`
Expected: FAIL — 404 on the mark-paid route.

- [ ] **Step 3: Write `app/Policies/OrderPolicy.php`**

```php
<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\User;

class OrderPolicy
{
    /**
     * Cashiers take money at the counter; an admin may stand in for them. The
     * state of the order — already paid, cancelled — is the confirmer's call,
     * because an admin passes this gate through `Gate::before`.
     */
    public function markPaid(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Cashier);
    }
}
```

- [ ] **Step 4: Write `app/Http/Controllers/Admin/MarkOrderPaidController.php`**

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\User;
use App\Services\PaymentConfirmer;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;

class MarkOrderPaidController extends Controller
{
    /**
     * Record a counter payment. The screen for this arrives with the cashier
     * queue in Module 6.
     */
    public function __invoke(Order $order, #[CurrentUser] User $user, PaymentConfirmer $confirmer): OrderResource
    {
        Gate::authorize('markPaid', $order);

        $confirmer->confirmAtCounter($order, $user);

        return OrderResource::make($order->refresh()->load('items'));
    }
}
```

- [ ] **Step 5: Add the ability and the route**

In `app/Http/Controllers/CurrentUserController.php`, inside `abilities`:

```php
                'mark_paid' => $user->can('markPaid', Order::class),
```

with `use App\Models\Order;` added.

In `routes/api.php`, inside the `password.changed` group beside the availability route:

```php
        Route::post('/orders/{order}/mark-paid', MarkOrderPaidController::class)->name('orders.mark-paid');
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Payments/MarkPaidTest.php`
Expected: PASS (5 tests).

Run: `php artisan test --compact`
Expected: every earlier test still passes.

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`

---

### Task 7: Paying from the guest's screens

**Files:**

- Create: `resources/js/lib/payments.ts`
- Modify: `resources/js/types/order.ts`
- Modify: `resources/js/pages/cart.tsx`, `resources/js/pages/order-status.tsx`, `resources/js/router.tsx`
- Test: `resources/js/lib/payments.test.ts`

**Interfaces:**

- Produces: `fetchCheckoutOptions()`, `checkoutOptionsLoader()`, `createCheckoutSession(token)`, `refreshPayment(token)`, `canPayOnline(total, options)`; types `CheckoutOptions`, `Payment`, and `PaymentMethod` widened to `'counter' | 'online'`.

- [ ] **Step 1: Write the failing test**

`resources/js/lib/payments.test.ts`:

```ts
import { describe, expect, it } from 'vite-plus/test';
import { canPayOnline } from '@/lib/payments';
import type { CheckoutOptions } from '@/types';

const online: CheckoutOptions = {
    tables: 20,
    methods: ['counter', 'online'],
    online_minimum: 10000,
};

const counterOnly: CheckoutOptions = {
    tables: 20,
    methods: ['counter'],
    online_minimum: 10000,
};

describe('canPayOnline', () => {
    it('offers online payment once the order reaches the minimum', () => {
        expect(canPayOnline(10000, online)).toBe(true);
        expect(canPayOnline(36000, online)).toBe(true);
    });

    it('keeps small orders at the counter', () => {
        expect(canPayOnline(9999, online)).toBe(false);
    });

    it('says no when the restaurant has no payment provider', () => {
        expect(canPayOnline(36000, counterOnly)).toBe(false);
    });
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/payments`.

- [ ] **Step 3: Widen the types in `resources/js/types/order.ts`**

```ts
export type PaymentMethod = 'counter' | 'online';

export type PaymentState = 'pending' | 'paid' | 'failed';

export type CheckoutOptions = {
    tables: number;
    methods: PaymentMethod[];
    online_minimum: number;
};

export type Payment = {
    checkout_url: string | null;
    amount: number;
    state: PaymentState;
    method: string | null;
    paid_at: string | null;
};
```

- [ ] **Step 4: Write `resources/js/lib/payments.ts`**

```ts
import { http } from '@/lib/http';
import type { CheckoutOptions, Order, Payment } from '@/types';

type Wrapped<T> = { data: T };

export async function fetchCheckoutOptions(): Promise<CheckoutOptions> {
    const response = await http.get<Wrapped<CheckoutOptions>>(
        '/api/v1/checkout/options',
    );

    return response.data;
}

/** Loader: what the cart may offer this guest. */
export function checkoutOptionsLoader(): Promise<CheckoutOptions> {
    return fetchCheckoutOptions();
}

/** Open a PayMongo checkout for an order and get the URL to send them to. */
export async function createCheckoutSession(token: string): Promise<Payment> {
    const response = await http.post<Wrapped<Payment>>(
        `/api/v1/orders/${token}/checkout-session`,
    );

    return response.data;
}

/** Ask our server to check with PayMongo how a payment ended. */
export async function refreshPayment(token: string): Promise<Order> {
    const response = await http.post<Wrapped<Order>>(
        `/api/v1/orders/${token}/payment/refresh`,
    );

    return response.data;
}

/** Whether this order may be paid online at all. */
export function canPayOnline(total: number, options: CheckoutOptions): boolean {
    return (
        options.methods.includes('online') && total >= options.online_minimum
    );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (3 new tests).

- [ ] **Step 6: Offer the choice on `resources/js/pages/cart.tsx`**

Read the checkout options from the route loader and let the guest pick. Replace the single "Pay at the counter" card with:

```tsx
const options = useLoaderData<typeof checkoutOptionsLoader>();
const [method, setMethod] = useState<PaymentMethod>('counter');
const onlineAvailable = canPayOnline(subtotal, options);
```

```tsx
<fieldset className="flex flex-col gap-3">
    <legend className="mb-2 font-display text-xl font-extrabold">
        How would you like to pay?
    </legend>

    <div role="group" className="grid gap-3 sm:grid-cols-2">
        <button
            type="button"
            aria-pressed={method === 'counter'}
            onClick={() => setMethod('counter')}
            className={cn(
                'flex min-h-20 flex-col justify-center rounded-xl border-2 px-4 text-left',
                method === 'counter'
                    ? 'border-dahon bg-dahon text-pandan'
                    : 'border-border bg-card',
            )}
        >
            <span className="font-display text-lg font-extrabold">
                Pay at the counter
            </span>
            <span className="text-sm opacity-80">
                The kitchen starts once it is paid.
            </span>
        </button>

        {onlineAvailable && (
            <button
                type="button"
                aria-pressed={method === 'online'}
                onClick={() => setMethod('online')}
                className={cn(
                    'flex min-h-20 flex-col justify-center rounded-xl border-2 px-4 text-left',
                    method === 'online'
                        ? 'border-dahon bg-dahon text-pandan'
                        : 'border-border bg-card',
                )}
            >
                <span className="font-display text-lg font-extrabold">
                    Pay online
                </span>
                <span className="text-sm opacity-80">
                    GCash or card, on PayMongo's page.
                </span>
            </button>
        )}
    </div>
</fieldset>
```

In `handleSubmit`, send the chosen method and take the guest to PayMongo when they picked online:

```tsx
            const order = await placeOrder({
                type,
                table_number: type === 'dine_in' ? cart.table : null,
                customer_name: type === 'takeout' ? name.trim() : null,
                payment_method: method,
                items: lines.map(({ line }) => ({ ... })),
            });

            rememberOrder(order.token);
            clear();

            if (method === 'online') {
                try {
                    const payment = await createCheckoutSession(order.token);

                    if (payment.checkout_url !== null) {
                        window.location.assign(payment.checkout_url);

                        return;
                    }
                } catch {
                    // The order is placed either way; the status screen offers
                    // both paying again and paying at the counter.
                }
            }

            void navigate(`/order/${order.token}`);
```

- [ ] **Step 7: Add the loader to `/cart` in `resources/js/router.tsx`**

```tsx
            { path: '/cart', element: <Cart />, loader: checkoutOptionsLoader },
```

with `import { checkoutOptionsLoader } from '@/lib/payments';`.

- [ ] **Step 8: Finish the payment on `resources/js/pages/order-status.tsx`**

Add, above the status steps:

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const revalidator = useRevalidator();
const [paying, setPaying] = useState(false);
const [payError, setPayError] = useState<string | null>(null);
const checked = useRef(false);

// Back from PayMongo: our server asks them how it went, then the page
// reloads the order.
useEffect(() => {
    if (searchParams.get('paid') !== '1' || checked.current) {
        return;
    }

    checked.current = true;

    refreshPayment(order.token)
        .then(() => {
            const next = new URLSearchParams(searchParams);
            next.delete('paid');
            setSearchParams(next, { replace: true });
            void revalidator.revalidate();
        })
        .catch(() => undefined);
}, [order.token, revalidator, searchParams, setSearchParams]);

async function handlePayOnline() {
    setPaying(true);
    setPayError(null);

    try {
        const payment = await createCheckoutSession(order.token);

        if (payment.checkout_url !== null) {
            window.location.assign(payment.checkout_url);

            return;
        }

        setPayError(
            'Online payment is not available right now. Please pay at the counter.',
        );
    } catch (failure) {
        setPayError(
            failure instanceof HttpError && failure.body.message
                ? failure.body.message
                : 'Online payment is not available right now. Please pay at the counter.',
        );
    }

    setPaying(false);
}
```

Replace the unpaid notice with the paid and unpaid cases:

```tsx
{
    order.payment_status === 'paid' ? (
        <p className="rounded-xl border-2 border-kalamansi bg-card p-4">
            <span className="font-display text-xl font-extrabold">Paid.</span>{' '}
            Thank you — the kitchen has your order.
        </p>
    ) : (
        order.status !== 'cancelled' && (
            <div className="flex flex-col gap-3 rounded-xl border-2 border-achuete bg-card p-4">
                <p>
                    <span className="font-display text-xl font-extrabold">
                        Not paid yet.
                    </span>{' '}
                    Show this number at the counter, or pay online now.
                </p>

                <Button
                    type="button"
                    className="min-h-12 w-fit rounded-full px-6"
                    disabled={paying}
                    onClick={handlePayOnline}
                >
                    {paying ? 'Opening…' : 'Pay online'}
                </Button>

                {payError && (
                    <p role="alert" className="font-semibold text-destructive">
                        {payError}
                    </p>
                )}
            </div>
        )
    );
}
```

- [ ] **Step 9: Verify**

Run: `npm run check:fix`
Run: `npm run types:check`
Run: `npm test`
Run: `npm run build`
Expected: all pass.

---

### Task 8: Module gate

**Files:** none — checks and a commit.

- [ ] **Step 1: Run every automated check**

Run: `php artisan test --compact`
Run: `composer types:check`
Run: `composer lint:check`
Run: `npm test`
Run: `npm run types:check`
Run: `npm run check`
Run: `npm run build`
Expected: all green.

- [ ] **Step 2: Confirm the routes**

Run: `php artisan route:list --path=api/v1 --except-vendor`
Expected: `POST api/v1/orders/{order}/checkout-session`, `POST api/v1/orders/{order}/payment/refresh`, `POST api/v1/webhooks/paymongo`, `POST api/v1/orders/{order}/mark-paid`, `GET api/v1/checkout/options`.

- [ ] **Step 3: Grep for the invariants**

Run: `grep -rn "PaymentStatus::Paid" app --include=*.php`
Expected: only `PaymentConfirmer`, plus reads in controllers and policies — nothing else writes `paid`.

Run: `grep -rn "paymongo" resources/js`
Expected: no match — no key, no provider call, and no trust in the browser.

- [ ] **Step 4: User walkthrough without PayMongo keys**

With `PAYMONGO_SECRET_KEY` empty and `composer run dev` running: place an order and confirm the cart offers **only** "Pay at the counter", and that the status screen's "Pay online" button answers "not available right now… pay at the counter".

Then, as a cashier, take the payment through the API (there is no screen until Module 6):

```bash
php artisan tinker --execute 'app(App\Services\PaymentConfirmer::class)->confirmAtCounter(App\Models\Order::query()->latest("id")->first(), App\Models\User::query()->where("role","cashier")->first());'
```

The guest's screen should turn to **Paid** within fifteen seconds without a reload.

- [ ] **Step 5: User walkthrough with PayMongo test keys (when they arrive)**

Put `PAYMONGO_SECRET_KEY=sk_test_...` in `.env`, run `php artisan config:clear`, then order and choose **Pay online**. PayMongo's test page opens; pay with their test GCash. On return, the screen says Paid. (The webhook cannot reach `localhost`, so this is the return path doing its job — Module 8 registers the real webhook URL.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: online payment through PayMongo and counter payments"
```
