# Module 4 — Cart & Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a walk-in guest build an order on their phone and place it, with every price recomputed on the server and the order trackable through an opaque token.

**Architecture:** The cart lives in the guest's browser (`localStorage`) and carries only ids, quantities and notes — never prices. `POST /api/v1/orders` re-reads every price from the database inside one transaction, snapshots the dish and size names into `order_items`, assigns a per-business-day order number (`BB-20260923-0031`), and returns a ULID token. The guest then watches `/order/{token}`, which polls the status endpoint. Nothing in the staff side changes: Module 4 only ever writes `pending` / `unpaid`.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5, PHPStan level 7 (Larastan), Pint, React 19, React Router 8, Tailwind 4, Vitest (`vp test run`).

**Spec:** `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md` (§4 Data Model, §5 Order State Machine, §6 Security Layers, §7 UI/UX Direction)

## Global Constraints

- Money is integer centavos, and money columns use the plain noun (`unit_price`, `subtotal`, `total`) to match `menu_item_sizes.price`.
- **Server-side price recompute at checkout. Client prices are ignored and totals come from the DB.** (spec §6)
- **Guests track orders by opaque `order_token` (ULID), never by numeric ID, to prevent IDOR.** (spec §6)
- **Order placement runs inside a DB transaction.** (spec §6)
- A Form Request on every write endpoint; pass only `$request->validated()` to models. Explicit `$fillable` on every model. API Resources on every response. (spec §6)
- `status` and `payment_status` are two independent tracks. Cart submitted → `pending` / `unpaid`. `confirmed` only comes from the cashier or a webhook, in later modules. (spec §5)
- Brainstorming decisions (2026-09-23): **Dine-in and Take-out**; the QR fills the table number and the guest may also type it; **one note per cart line, max 120 characters**; **no service charge** — `total` equals `subtotal`.
- UI copy is English. The palette and type are already set (`--dahon`, `--pandan`, `--achuete`, `--kalamansi`, `--kawayan`, Bricolage Grotesque, Instrument Sans).
- Mobile-first: everything must work at 320px with no horizontal scroll, and tap targets stay at least 44px tall.
- After every PHP edit run `vendor/bin/pint --dirty --format agent`.
- Verification commands Claude runs: `php artisan test --compact`, `composer types:check`, `npm test`, `npm run types:check`, `npm run check`, `npm run build`.
- Commands the **user** runs: `php artisan migrate`, any install, and `git commit`.

## File Structure

**Backend**

| File                                                                 | Responsibility                                      |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| `config/restaurant.php`                                              | Table count, business timezone, order-number prefix |
| `database/migrations/2026_09_23_000000_create_orders_table.php`      | `orders`                                            |
| `database/migrations/2026_09_23_000100_create_order_items_table.php` | `order_items`                                       |
| `app/Enums/OrderType.php`                                            | `dine_in` / `takeout`                               |
| `app/Enums/OrderStatus.php`                                          | The status track plus display labels                |
| `app/Enums/PaymentStatus.php`                                        | The payment track                                   |
| `app/Enums/PaymentMethod.php`                                        | `counter` (Module 5 adds `online`)                  |
| `app/Models/Order.php`                                               | ULID token, route binding, casts, `items()`         |
| `app/Models/OrderItem.php`                                           | One snapshotted line                                |
| `database/factories/OrderFactory.php`, `OrderItemFactory.php`        | Test data                                           |
| `app/Services/OrderPlacer.php`                                       | The only place that turns guest lines into an order |
| `app/Http/Requests/PlaceOrderRequest.php`                            | Shape and limits of the checkout payload            |
| `app/Http/Controllers/OrderController.php`                           | `store` (place) and `show` (track)                  |
| `app/Http/Resources/OrderResource.php`, `OrderItemResource.php`      | Guest-facing JSON, no internal ids                  |
| `routes/api.php`                                                     | `POST /orders`, `GET /orders/{order}`               |
| `app/Providers/AppServiceProvider.php`                               | The `orders` rate limiter                           |

**Frontend**

| File                                                 | Responsibility                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `resources/js/types/order.ts`                        | Order, line and payload types                                  |
| `resources/js/lib/cart.ts`                           | Pure cart maths, pricing against the live menu, `localStorage` |
| `resources/js/lib/cart-context.ts`                   | The context object and `useCart()`                             |
| `resources/js/components/cart/cart-provider.tsx`     | Holds cart state, saves it, reads `?table=` from the QR        |
| `resources/js/components/cart/order-bar.tsx`         | Sticky "N items · ₱540 — Review order" bar                     |
| `resources/js/components/cart/quantity-stepper.tsx`  | − / value / + control                                          |
| `resources/js/components/cart/recent-order-link.tsx` | "Your order" link in the header after checkout                 |
| `resources/js/components/public/menu-row.tsx`        | One menu row: plate, copy, add buttons, the lift animation     |
| `resources/js/lib/orders.ts`                         | `placeOrder`, `fetchOrder`, `orderLoader`, recent-order memory |
| `resources/js/lib/order-polling.ts`                  | `useOrderUpdates` — refresh while the tab is visible           |
| `resources/js/pages/cart.tsx`                        | Cart plus checkout in one page                                 |
| `resources/js/pages/order-status.tsx`                | Order number, payment note, status, lines                      |
| `resources/js/pages/menu.tsx`                        | _Modify:_ render `MenuRow`                                     |
| `resources/js/layouts/public-layout.tsx`             | _Modify:_ `CartProvider`, `OrderBar`, `RecentOrderLink`        |
| `resources/js/router.tsx`                            | _Modify:_ `/cart` and `/order/:token`                          |
| `resources/css/app.css`                              | _Modify:_ `.plate-lift` animation                              |
| `resources/views/app.blade.php`                      | _Modify:_ `viewport-fit=cover` for the safe area               |

**Tests**

| File                                       | Covers                                           |
| ------------------------------------------ | ------------------------------------------------ |
| `tests/Feature/Orders/OrderModelsTest.php` | Token, route key, snapshots surviving menu edits |
| `tests/Feature/Orders/OrderPlacerTest.php` | Pricing, numbering, refusals                     |
| `tests/Feature/Orders/PlaceOrderTest.php`  | The endpoint: validation, tampering, throttle    |
| `tests/Feature/Orders/OrderStatusTest.php` | Tracking by token                                |
| `resources/js/lib/cart.test.ts`            | Cart maths, storage, pricing against the menu    |
| `resources/js/lib/orders.test.ts`          | Recent-order memory                              |

---

### Task 1: Orders schema, enums and models

**Files:**

- Create: `config/restaurant.php`
- Create: `database/migrations/2026_09_23_000000_create_orders_table.php`
- Create: `database/migrations/2026_09_23_000100_create_order_items_table.php`
- Create: `app/Enums/OrderType.php`, `app/Enums/OrderStatus.php`, `app/Enums/PaymentStatus.php`, `app/Enums/PaymentMethod.php`
- Create: `app/Models/Order.php`, `app/Models/OrderItem.php`
- Create: `database/factories/OrderFactory.php`, `database/factories/OrderItemFactory.php`
- Modify: `.env.example` (add `RESTAURANT_TABLES=20`)
- Modify: `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md` (§4 `orders` row)
- Test: `tests/Feature/Orders/OrderModelsTest.php`

**Interfaces:**

- Consumes: `App\Models\MenuItem`, `App\Models\MenuItemSize` (`price` in centavos, `menu_item_id`), `Category` soft deletes.
- Produces: `Order` with `$order->token` (26-char ULID, also the route key), `$order->items` (`HasMany<OrderItem>`), casts to `OrderType`, `OrderStatus`, `PaymentStatus`, `PaymentMethod`; `OrderItem` with `item_name`, `size_name`, `unit_price`, `quantity`, `line_total`, `note`; `config('restaurant.tables')`, `config('restaurant.timezone')`, `config('restaurant.order_prefix')`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Orders/OrderModelsTest.php`:

```php
<?php

use App\Enums\OrderStatus;
use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\MenuItemSize;
use App\Models\Order;

function line(MenuItemSize $size, int $quantity = 2): array
{
    return [
        'menu_item_id' => $size->menu_item_id,
        'menu_item_size_id' => $size->id,
        'item_name' => 'Adobo',
        'size_name' => $size->name,
        'unit_price' => $size->price,
        'quantity' => $quantity,
        'line_total' => $size->price * $quantity,
    ];
}

test('an order is keyed by an opaque token, never by its id', function () {
    $order = Order::factory()->create();

    expect($order->token)->toHaveLength(26)
        ->and($order->getRouteKeyName())->toBe('token')
        ->and($order->getRouteKey())->toBe($order->token)
        ->and($order->id)->toBeInt();
});

test('an order casts its tracks and money', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);

    expect($order->type)->toBe(OrderType::DineIn)
        ->and($order->status)->toBe(OrderStatus::Pending)
        ->and($order->payment_status)->toBe(PaymentStatus::Unpaid)
        ->and($order->payment_method)->toBe(PaymentMethod::Counter)
        ->and($order->total)->toBe(36000);
});

test('a line keeps its snapshot when the menu price changes later', function () {
    $size = MenuItemSize::factory()->create(['name' => 'Large', 'price' => 18000]);
    $order = Order::factory()->create();
    $order->items()->create(line($size));

    $size->update(['price' => 25000]);

    expect($order->items()->sole()->unit_price)->toBe(18000)
        ->and($order->items()->sole()->line_total)->toBe(36000);
});

test('a line survives the size being removed from the menu', function () {
    $size = MenuItemSize::factory()->create(['name' => 'Large', 'price' => 18000]);
    $order = Order::factory()->create();
    $order->items()->create(line($size));

    $size->delete();

    $item = $order->items()->sole();

    expect($item->menu_item_size_id)->toBeNull()
        ->and($item->size_name)->toBe('Large')
        ->and($item->item_name)->toBe('Adobo');
});

test('two orders on the same day cannot share a daily number', function () {
    $first = Order::factory()->create(['business_date' => '2026-09-23', 'daily_number' => 1]);

    expect(fn () => Order::factory()->create([
        'business_date' => '2026-09-23',
        'daily_number' => 1,
        'order_number' => $first->order_number.'-copy',
    ]))->toThrow(Illuminate\Database\UniqueConstraintViolationException::class);
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Orders/OrderModelsTest.php`
Expected: FAIL — `Class "App\Models\Order" not found`.

- [ ] **Step 3: Write `config/restaurant.php`**

```php
<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Dining Tables
    |--------------------------------------------------------------------------
    |
    | The highest table number a guest may order from. Table numbers arrive in
    | the QR code on each table, so this is the guard against a typed or
    | tampered number pointing at a table that does not exist.
    |
    */

    'tables' => (int) env('RESTAURANT_TABLES', 20),

    /*
    |--------------------------------------------------------------------------
    | Business Day
    |--------------------------------------------------------------------------
    |
    | Order numbers restart at 1 every business day, counted in the restaurant's
    | own timezone rather than the server's.
    |
    */

    'timezone' => (string) env('RESTAURANT_TIMEZONE', 'Asia/Manila'),

    /*
    |--------------------------------------------------------------------------
    | Order Number Prefix
    |--------------------------------------------------------------------------
    |
    | Order numbers read BB-20260923-0031: prefix, business date, daily number.
    |
    */

    'order_prefix' => (string) env('RESTAURANT_ORDER_PREFIX', 'BB'),

];
```

Add to `.env.example`, under the `APP_` block:

```dotenv
RESTAURANT_TABLES=20
```

- [ ] **Step 4: Write the four enums**

`app/Enums/OrderType.php`:

```php
<?php

namespace App\Enums;

enum OrderType: string
{
    case DineIn = 'dine_in';
    case Takeout = 'takeout';

    /**
     * Human-readable name shown to the guest and on the order screens.
     */
    public function label(): string
    {
        return match ($this) {
            self::DineIn => 'Dine in',
            self::Takeout => 'Take out',
        };
    }
}
```

`app/Enums/OrderStatus.php`:

```php
<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Preparing = 'preparing';
    case Ready = 'ready';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    /**
     * Human-readable status shown to the guest.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Waiting for payment',
            self::Confirmed => 'Confirmed',
            self::Preparing => 'Preparing',
            self::Ready => 'Ready',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * Whether the guest's screen should keep watching for changes.
     */
    public function isOpen(): bool
    {
        return ! in_array($this, [self::Completed, self::Cancelled], true);
    }
}
```

`app/Enums/PaymentStatus.php`:

```php
<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Unpaid = 'unpaid';
    case Paid = 'paid';
}
```

`app/Enums/PaymentMethod.php`:

```php
<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case Counter = 'counter';

    /**
     * Human-readable method shown at checkout.
     */
    public function label(): string
    {
        return match ($this) {
            self::Counter => 'Pay at the counter',
        };
    }
}
```

- [ ] **Step 5: Write the migrations**

`database/migrations/2026_09_23_000000_create_orders_table.php`:

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
```

`database/migrations/2026_09_23_000100_create_order_items_table.php`:

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
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('menu_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('menu_item_size_id')->nullable()->constrained()->nullOnDelete();
            $table->string('item_name', 80);
            $table->string('size_name', 40);
            $table->unsignedInteger('unit_price');
            $table->unsignedSmallInteger('quantity');
            $table->unsignedInteger('line_total');
            $table->string('note', 120)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
```

- [ ] **Step 6: Write the models**

`app/Models/Order.php`:

```php
<?php

namespace App\Models;

use App\Enums\OrderStatus;
use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $token
 * `business_date` stays a plain `Y-m-d` string rather than a date cast, so the
 * daily counter compares the same value on MySQL and on SQLite.
 *
 * @property string $order_number
 * @property string $business_date
 * @property int $daily_number
 * @property OrderType $type
 * @property int|null $table_number
 * @property string|null $customer_name
 * @property OrderStatus $status
 * @property PaymentStatus $payment_status
 * @property PaymentMethod $payment_method
 * @property int $subtotal
 * @property int $total
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, OrderItem> $items
 */
#[Fillable(['type', 'table_number', 'customer_name', 'payment_method'])]
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory, HasUlids;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'table_number' => null,
        'customer_name' => null,
        'status' => OrderStatus::Pending->value,
        'payment_status' => PaymentStatus::Unpaid->value,
    ];

    /**
     * The guest only ever holds the token, so route binding uses it.
     */
    public function getRouteKeyName(): string
    {
        return 'token';
    }

    /**
     * The ULID goes in `token`; the primary key stays an auto-incrementing id.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['token'];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'daily_number' => 'integer',
            'type' => OrderType::class,
            'table_number' => 'integer',
            'status' => OrderStatus::class,
            'payment_status' => PaymentStatus::class,
            'payment_method' => PaymentMethod::class,
            'subtotal' => 'integer',
            'total' => 'integer',
        ];
    }

    /**
     * The snapshotted lines, in the order the guest built them.
     *
     * @return HasMany<OrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class)->orderBy('id');
    }
}
```

`app/Models/OrderItem.php`:

```php
<?php

namespace App\Models;

use Database\Factories\OrderItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A line as it was ordered: the names and the price are copies, so editing the
 * menu later never rewrites an old order.
 *
 * @property int $id
 * @property int $order_id
 * @property int|null $menu_item_id
 * @property int|null $menu_item_size_id
 * @property string $item_name
 * @property string $size_name
 * @property int $unit_price
 * @property int $quantity
 * @property int $line_total
 * @property string|null $note
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Order $order
 */
#[Fillable([
    'menu_item_id',
    'menu_item_size_id',
    'item_name',
    'size_name',
    'unit_price',
    'quantity',
    'line_total',
    'note',
])]
class OrderItem extends Model
{
    /** @use HasFactory<OrderItemFactory> */
    use HasFactory;

    /**
     * In-memory defaults that mirror the database.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'menu_item_id' => null,
        'menu_item_size_id' => null,
        'note' => null,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'unit_price' => 'integer',
            'quantity' => 'integer',
            'line_total' => 'integer',
        ];
    }

    /**
     * The order this line belongs to.
     *
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
```

- [ ] **Step 7: Write the factories**

`database/factories/OrderFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Date;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $today = Date::now((string) config('restaurant.timezone'));
        $dailyNumber = fake()->unique()->numberBetween(1, 9999);

        return [
            'order_number' => sprintf(
                '%s-%s-%04d',
                (string) config('restaurant.order_prefix'),
                $today->format('Ymd'),
                $dailyNumber,
            ),
            'business_date' => $today->toDateString(),
            'daily_number' => $dailyNumber,
            'type' => OrderType::DineIn,
            'table_number' => fake()->numberBetween(1, 20),
            'customer_name' => null,
            'status' => OrderStatus::Pending,
            'payment_status' => PaymentStatus::Unpaid,
            'payment_method' => PaymentMethod::Counter,
            'subtotal' => 0,
            'total' => 0,
        ];
    }

    /**
     * An order somebody is waiting to carry out.
     */
    public function takeout(): static
    {
        return $this->state(fn (): array => [
            'type' => OrderType::Takeout,
            'table_number' => null,
            'customer_name' => fake()->firstName(),
        ]);
    }
}
```

`database/factories/OrderItemFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $unitPrice = fake()->numberBetween(50, 400) * 100;
        $quantity = fake()->numberBetween(1, 3);

        return [
            'order_id' => Order::factory(),
            'menu_item_id' => MenuItem::factory(),
            'menu_item_size_id' => null,
            'item_name' => Str::title(rtrim(fake()->unique()->sentence(2), '.')),
            'size_name' => 'Regular',
            'unit_price' => $unitPrice,
            'quantity' => $quantity,
            'line_total' => $unitPrice * $quantity,
            'note' => null,
        ];
    }
}
```

- [ ] **Step 8: Ask the user to migrate**

Tell the user, in one sentence, to run:

```bash
php artisan migrate
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Orders/OrderModelsTest.php`
Expected: PASS (5 tests).

- [ ] **Step 10: Sync the spec and format**

In `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md` §4, replace the `orders` row with:

```markdown
| `orders` | Human-readable `order_number` (`BB-20260922-0031`, restarting daily in Manila time), opaque `order_token` (ULID), `type` (dine-in or take-out), `table_number` or `customer_name`, `status`, `payment_status`, `payment_method`, totals. No service charge: `total` equals `subtotal`. |
```

Run: `vendor/bin/pint --dirty --format agent`
Expected: all touched files formatted.

---

### Task 2: Pricing and numbering in `OrderPlacer`

**Files:**

- Create: `app/Services/OrderPlacer.php`
- Test: `tests/Feature/Orders/OrderPlacerTest.php`

**Interfaces:**

- Consumes: `Order`, `OrderItem`, `MenuItemSize` with `menuItem.category`, `config('restaurant.timezone')`, `config('restaurant.order_prefix')`.
- Produces: `OrderPlacer::place(OrderType $type, PaymentMethod $paymentMethod, ?int $tableNumber, ?string $customerName, array $lines): Order`, where each line is `array{menu_item_id: int, menu_item_size_id: int, quantity: int, note?: string|null}`. Throws `ValidationException` keyed `items.{index}.menu_item_size_id` when a line is not orderable. The returned order has `items` loaded.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Orders/OrderPlacerTest.php`:

```php
<?php

use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\MenuItemSize;
use App\Models\Order;
use App\Services\OrderPlacer;
use Illuminate\Support\Facades\Date;
use Illuminate\Validation\ValidationException;

function placeLines(array $lines, OrderType $type = OrderType::DineIn, ?int $table = 7, ?string $name = null): Order
{
    return app(OrderPlacer::class)->place($type, PaymentMethod::Counter, $table, $name, $lines);
}

function lineFor(MenuItemSize $size, int $quantity = 2, ?string $note = null): array
{
    return [
        'menu_item_id' => $size->menu_item_id,
        'menu_item_size_id' => $size->id,
        'quantity' => $quantity,
        'note' => $note,
    ];
}

test('every price comes from the database and is snapshotted', function () {
    $item = MenuItem::factory()->create(['name' => 'Adobo']);
    $size = MenuItemSize::factory()->for($item, 'menuItem')->create(['name' => 'Large', 'price' => 18000]);

    $order = placeLines([lineFor($size, 3)]);

    expect($order->subtotal)->toBe(54000)
        ->and($order->total)->toBe(54000)
        ->and($order->items)->toHaveCount(1);

    $line = $order->items->first();

    expect($line->item_name)->toBe('Adobo')
        ->and($line->size_name)->toBe('Large')
        ->and($line->unit_price)->toBe(18000)
        ->and($line->line_total)->toBe(54000);
});

test('order numbers count up per business day and restart the next day', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $this->travelTo(Date::parse('2026-09-23 20:00', 'Asia/Manila'));
    $first = placeLines([lineFor($size)]);
    $second = placeLines([lineFor($size)]);

    $this->travelTo(Date::parse('2026-09-24 09:00', 'Asia/Manila'));
    $nextDay = placeLines([lineFor($size)]);

    expect($first->order_number)->toBe('BB-20260923-0001')
        ->and($second->order_number)->toBe('BB-20260923-0002')
        ->and($second->daily_number)->toBe(2)
        ->and($nextDay->order_number)->toBe('BB-20260924-0001');
});

test('a take-out order carries a name instead of a table', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $order = placeLines([lineFor($size)], OrderType::Takeout, null, 'Ana');

    expect($order->type)->toBe(OrderType::Takeout)
        ->and($order->table_number)->toBeNull()
        ->and($order->customer_name)->toBe('Ana');
});

test('a sold-out dish is refused with the line flagged', function () {
    $item = MenuItem::factory()->unavailable()->create(['name' => 'Kare-Kare']);
    $size = MenuItemSize::factory()->for($item, 'menuItem')->create(['price' => 26000]);

    expect(fn () => placeLines([lineFor($size)]))
        ->toThrow(ValidationException::class);

    expect(Order::query()->count())->toBe(0);
});

test('archived dishes and archived categories are refused', function () {
    $archivedItem = MenuItem::factory()->create();
    $archivedSize = MenuItemSize::factory()->for($archivedItem, 'menuItem')->create(['price' => 10000]);
    $archivedItem->delete();

    $category = Category::factory()->create();
    $item = MenuItem::factory()->for($category)->create();
    $size = MenuItemSize::factory()->for($item, 'menuItem')->create(['price' => 10000]);
    $category->delete();

    expect(fn () => placeLines([lineFor($archivedSize)]))->toThrow(ValidationException::class);
    expect(fn () => placeLines([lineFor($size)]))->toThrow(ValidationException::class);
});

test('a size that belongs to another dish is refused', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);
    $other = MenuItem::factory()->create();

    $tampered = ['menu_item_id' => $other->id, 'menu_item_size_id' => $size->id, 'quantity' => 1, 'note' => null];

    expect(fn () => placeLines([$tampered]))->toThrow(ValidationException::class);
});

test('a blank note is stored as nothing at all', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $order = placeLines([lineFor($size, 1, '   ')]);

    expect($order->items->first()->note)->toBeNull();
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Orders/OrderPlacerTest.php`
Expected: FAIL — `Class "App\Services\OrderPlacer" not found`.

- [ ] **Step 3: Write `app/Services/OrderPlacer.php`**

```php
<?php

namespace App\Services;

use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Models\MenuItemSize;
use App\Models\Order;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Turns a guest's cart into an order. Every price is read here, from the
 * database, so a tampered cart can only ever change quantities.
 */
class OrderPlacer
{
    /**
     * Place an order, or fail with the offending line flagged.
     *
     * @param  array<int, array{menu_item_id: int, menu_item_size_id: int, quantity: int, note?: string|null}>  $lines
     *
     * @throws ValidationException
     */
    public function place(
        OrderType $type,
        PaymentMethod $paymentMethod,
        ?int $tableNumber,
        ?string $customerName,
        array $lines,
    ): Order {
        $priced = $this->price($lines, $this->sizesFor($lines));

        return retry(
            3,
            fn (): Order => DB::transaction(
                fn (): Order => $this->store($type, $paymentMethod, $tableNumber, $customerName, $priced),
            ),
            0,
            fn (Throwable $e): bool => $e instanceof UniqueConstraintViolationException,
        );
    }

    /**
     * Load every size the cart points at, with its dish and category.
     *
     * @param  array<int, array{menu_item_size_id: int, ...}>  $lines
     * @return Collection<int|string, MenuItemSize>
     */
    private function sizesFor(array $lines): Collection
    {
        return MenuItemSize::query()
            ->with(['menuItem.category'])
            ->whereIn('id', array_column($lines, 'menu_item_size_id'))
            ->get()
            ->keyBy('id');
    }

    /**
     * Price each line from the database, refusing anything a guest can no
     * longer order.
     *
     * @param  array<int, array{menu_item_id: int, menu_item_size_id: int, quantity: int, note?: string|null}>  $lines
     * @param  Collection<int|string, MenuItemSize>  $sizes
     * @return array<int, array{menu_item_id: int, menu_item_size_id: int, item_name: string, size_name: string, unit_price: int, quantity: int, line_total: int, note: string|null}>
     *
     * @throws ValidationException
     */
    private function price(array $lines, Collection $sizes): array
    {
        $priced = [];

        foreach (array_values($lines) as $index => $line) {
            $size = $sizes->get($line['menu_item_size_id']);
            $item = $size?->menuItem;

            if ($size === null || $item === null || $size->menu_item_id !== (int) $line['menu_item_id']) {
                throw ValidationException::withMessages([
                    "items.{$index}.menu_item_size_id" => 'That dish is no longer on the menu.',
                ]);
            }

            if (! $item->is_available || $item->category->trashed()) {
                throw ValidationException::withMessages([
                    "items.{$index}.menu_item_size_id" => "{$item->name} is sold out today.",
                ]);
            }

            $quantity = (int) $line['quantity'];
            $note = trim((string) ($line['note'] ?? ''));

            $priced[] = [
                'menu_item_id' => $item->id,
                'menu_item_size_id' => $size->id,
                'item_name' => $item->name,
                'size_name' => $size->name,
                'unit_price' => $size->price,
                'quantity' => $quantity,
                'line_total' => $size->price * $quantity,
                'note' => $note === '' ? null : $note,
            ];
        }

        return $priced;
    }

    /**
     * Write the order and its lines, taking the next number of the business day.
     *
     * @param  array<int, array{menu_item_id: int, menu_item_size_id: int, item_name: string, size_name: string, unit_price: int, quantity: int, line_total: int, note: string|null}>  $priced
     */
    private function store(
        OrderType $type,
        PaymentMethod $paymentMethod,
        ?int $tableNumber,
        ?string $customerName,
        array $priced,
    ): Order {
        $today = Date::now((string) config('restaurant.timezone'));

        $dailyNumber = (int) Order::query()
            ->where('business_date', $today->toDateString())
            ->lockForUpdate()
            ->max('daily_number') + 1;

        $subtotal = (int) array_sum(array_column($priced, 'line_total'));

        $order = new Order([
            'type' => $type,
            'table_number' => $tableNumber,
            'customer_name' => $customerName,
            'payment_method' => $paymentMethod,
        ]);

        $order->order_number = sprintf(
            '%s-%s-%04d',
            (string) config('restaurant.order_prefix'),
            $today->format('Ymd'),
            $dailyNumber,
        );
        $order->business_date = $today->toDateString();
        $order->daily_number = $dailyNumber;
        $order->subtotal = $subtotal;
        $order->total = $subtotal;
        $order->save();

        $order->items()->createMany($priced);

        return $order->load('items');
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Orders/OrderPlacerTest.php`
Expected: PASS (7 tests).

- [ ] **Step 5: Format and analyse**

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`
Expected: no errors.

---

### Task 3: The place-order endpoint

**Files:**

- Create: `app/Http/Requests/PlaceOrderRequest.php`
- Create: `app/Http/Controllers/OrderController.php`
- Create: `app/Http/Resources/OrderResource.php`, `app/Http/Resources/OrderItemResource.php`
- Modify: `routes/api.php` (add `POST /orders`)
- Modify: `app/Providers/AppServiceProvider.php` (`configureRateLimiting`)
- Test: `tests/Feature/Orders/PlaceOrderTest.php`

**Interfaces:**

- Consumes: `OrderPlacer::place(...)` from Task 2.
- Produces: `POST /api/v1/orders` returning 201 with `{"data": {...}}` shaped by `OrderResource`: `token`, `order_number`, `daily_number`, `type`, `type_label`, `table_number`, `customer_name`, `status`, `status_label`, `payment_status`, `payment_method`, `payment_method_label`, `subtotal`, `total`, `placed_at`, `items[]`. Each item: `id`, `item_name`, `size_name`, `unit_price`, `quantity`, `line_total`, `note`. Rate limiter named `orders`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Orders/PlaceOrderTest.php`:

```php
<?php

use App\Models\MenuItem;
use App\Models\MenuItemSize;
use App\Models\Order;

function orderPayload(MenuItemSize $size, array $overrides = []): array
{
    return array_replace([
        'type' => 'dine_in',
        'table_number' => 7,
        'customer_name' => null,
        'payment_method' => 'counter',
        'items' => [[
            'menu_item_id' => $size->menu_item_id,
            'menu_item_size_id' => $size->id,
            'quantity' => 2,
            'note' => 'Walang sibuyas',
        ]],
    ], $overrides);
}

test('a guest places a dine-in order and gets a token back', function () {
    $item = MenuItem::factory()->create(['name' => 'Adobo']);
    $size = MenuItemSize::factory()->for($item, 'menuItem')->create(['name' => 'Large', 'price' => 18000]);

    $response = $this->postJson('/api/v1/orders', orderPayload($size))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.payment_status', 'unpaid')
        ->assertJsonPath('data.table_number', 7)
        ->assertJsonPath('data.total', 36000)
        ->assertJsonPath('data.items.0.item_name', 'Adobo')
        ->assertJsonPath('data.items.0.size_name', 'Large')
        ->assertJsonPath('data.items.0.note', 'Walang sibuyas')
        ->assertJsonMissingPath('data.id');

    expect($response->json('data.token'))->toHaveLength(26);
    expect(Order::query()->sole()->total)->toBe(36000);
});

test('prices sent by the browser are ignored', function () {
    $size = MenuItemSize::factory()->create(['price' => 18000]);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'items' => [[
            'menu_item_id' => $size->menu_item_id,
            'menu_item_size_id' => $size->id,
            'quantity' => 2,
            'unit_price' => 1,
            'line_total' => 2,
            'price' => 1,
        ]],
        'subtotal' => 2,
        'total' => 2,
    ]))
        ->assertCreated()
        ->assertJsonPath('data.total', 36000)
        ->assertJsonPath('data.items.0.unit_price', 18000);
});

test('dine-in needs a table the restaurant actually has', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $this->postJson('/api/v1/orders', orderPayload($size, ['table_number' => null]))
        ->assertJsonValidationErrors(['table_number']);

    $this->postJson('/api/v1/orders', orderPayload($size, ['table_number' => 99]))
        ->assertJsonValidationErrors(['table_number']);

    expect(Order::query()->count())->toBe(0);
});

test('take-out needs a name and drops the table', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $this->postJson('/api/v1/orders', orderPayload($size, ['type' => 'takeout', 'customer_name' => null]))
        ->assertJsonValidationErrors(['customer_name']);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'type' => 'takeout',
        'table_number' => 7,
        'customer_name' => 'Ana',
    ]))
        ->assertCreated()
        ->assertJsonPath('data.type', 'takeout')
        ->assertJsonPath('data.customer_name', 'Ana')
        ->assertJsonPath('data.table_number', null);
});

test('an order cannot be bigger than the kitchen can take', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);
    $line = ['menu_item_id' => $size->menu_item_id, 'menu_item_size_id' => $size->id, 'quantity' => 1];

    $this->postJson('/api/v1/orders', orderPayload($size, ['items' => array_fill(0, 31, $line)]))
        ->assertJsonValidationErrors(['items']);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'items' => [array_replace($line, ['quantity' => 21])],
    ]))->assertJsonValidationErrors(['items.0.quantity']);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'items' => [array_replace($line, ['note' => str_repeat('a', 121)])],
    ]))->assertJsonValidationErrors(['items.0.note']);

    $this->postJson('/api/v1/orders', orderPayload($size, ['items' => []]))
        ->assertJsonValidationErrors(['items']);
});

test('a dish that sold out while the cart was open flags its own line', function () {
    $item = MenuItem::factory()->unavailable()->create();
    $size = MenuItemSize::factory()->for($item, 'menuItem')->create(['price' => 10000]);

    $this->postJson('/api/v1/orders', orderPayload($size))
        ->assertJsonValidationErrors(['items.0.menu_item_size_id']);

    expect(Order::query()->count())->toBe(0);
});

test('one phone cannot spam the kitchen with orders', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    foreach (range(1, 30) as $attempt) {
        $this->postJson('/api/v1/orders', orderPayload($size))->assertCreated();
    }

    $this->postJson('/api/v1/orders', orderPayload($size))->assertTooManyRequests();
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Orders/PlaceOrderTest.php`
Expected: FAIL — 404, because `POST /api/v1/orders` does not exist yet.

- [ ] **Step 3: Write `app/Http/Requests/PlaceOrderRequest.php`**

```php
<?php

namespace App\Http\Requests;

use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PlaceOrderRequest extends FormRequest
{
    /**
     * Anyone in the restaurant may order; guests never sign in.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Keep only the field that belongs to the chosen order type.
     */
    protected function prepareForValidation(): void
    {
        $isDineIn = $this->input('type') === OrderType::DineIn->value;
        $name = trim((string) $this->input('customer_name', ''));

        $this->merge([
            'table_number' => $isDineIn ? $this->input('table_number') : null,
            'customer_name' => $isDineIn || $name === '' ? null : $name,
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::enum(OrderType::class)],
            'table_number' => [
                Rule::requiredIf(fn (): bool => $this->input('type') === OrderType::DineIn->value),
                'nullable',
                'integer',
                'min:1',
                'max:'.(int) config('restaurant.tables'),
            ],
            'customer_name' => [
                Rule::requiredIf(fn (): bool => $this->input('type') === OrderType::Takeout->value),
                'nullable',
                'string',
                'max:40',
            ],
            'payment_method' => ['required', Rule::enum(PaymentMethod::class)],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*.menu_item_id' => ['required', 'integer', 'min:1'],
            'items.*.menu_item_size_id' => ['required', 'integer', 'min:1'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:20'],
            'items.*.note' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * Get the error messages for the defined validation rules.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'table_number.required' => 'Tell us which table you are on.',
            'table_number.max' => 'We do not have a table with that number.',
            'customer_name.required' => 'Add a name so we can call you.',
            'items.required' => 'Your order is empty.',
            'items.min' => 'Your order is empty.',
            'items.max' => 'That is too many dishes for one order. Please split it.',
        ];
    }
}
```

- [ ] **Step 4: Write the resources**

`app/Http/Resources/OrderItemResource.php`:

```php
<?php

namespace App\Http\Resources;

use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OrderItem
 */
class OrderItemResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'item_name' => $this->item_name,
            'size_name' => $this->size_name,
            'unit_price' => $this->unit_price,
            'quantity' => $this->quantity,
            'line_total' => $this->line_total,
            'note' => $this->note,
        ];
    }
}
```

`app/Http/Resources/OrderResource.php`:

```php
<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The guest's view of an order. The primary key never leaves the server: the
 * token is the only handle a guest holds.
 *
 * @mixin Order
 */
class OrderResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'token' => $this->token,
            'order_number' => $this->order_number,
            'daily_number' => $this->daily_number,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'table_number' => $this->table_number,
            'customer_name' => $this->customer_name,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'payment_status' => $this->payment_status->value,
            'payment_method' => $this->payment_method->value,
            'payment_method_label' => $this->payment_method->label(),
            'subtotal' => $this->subtotal,
            'total' => $this->total,
            'placed_at' => $this->created_at?->toIso8601String(),
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
```

- [ ] **Step 5: Write `app/Http/Controllers/OrderController.php`**

```php
<?php

namespace App\Http\Controllers;

use App\Enums\OrderType;
use App\Enums\PaymentMethod;
use App\Http\Requests\PlaceOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderPlacer;
use Illuminate\Http\JsonResponse;

class OrderController extends Controller
{
    /**
     * Place a guest order. The request carries dishes and quantities only:
     * every price is read from the database inside the placer.
     */
    public function store(PlaceOrderRequest $request, OrderPlacer $placer): JsonResponse
    {
        $order = $placer->place(
            type: OrderType::from($request->validated('type')),
            paymentMethod: PaymentMethod::from($request->validated('payment_method')),
            tableNumber: $request->validated('table_number'),
            customerName: $request->validated('customer_name'),
            lines: $request->validated('items'),
        );

        return OrderResource::make($order)->response()->setStatusCode(201);
    }

    /**
     * One order, for whoever holds its token.
     */
    public function show(Order $order): OrderResource
    {
        return OrderResource::make($order->load('items'));
    }
}
```

- [ ] **Step 6: Add the route and the rate limiter**

In `routes/api.php`, under the existing menu route (and add `use App\Http\Controllers\OrderController;` to the imports):

```php
Route::post('/orders', [OrderController::class, 'store'])
    ->middleware('throttle:orders')
    ->name('orders.store');
```

In `app/Providers/AppServiceProvider.php`, inside `configureRateLimiting()`, after the `api` limiter:

```php
RateLimiter::for('orders', function (Request $request): array {
    $limits = [Limit::perMinute(30)->by('ip:'.$request->ip())];

    if ($request->hasSession()) {
        $limits[] = Limit::perMinute(6)->by('device:'.$request->session()->getId());
    }

    return $limits;
});
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Orders/PlaceOrderTest.php`
Expected: PASS (7 tests).

- [ ] **Step 8: Format and analyse**

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`
Expected: no errors.

---

### Task 4: The order tracking endpoint

**Files:**

- Modify: `routes/api.php` (add `GET /orders/{order}`)
- Test: `tests/Feature/Orders/OrderStatusTest.php`

**Interfaces:**

- Consumes: `OrderController::show(Order $order)` from Task 3, `Order::getRouteKeyName() === 'token'`.
- Produces: `GET /api/v1/orders/{token}` returning the same `OrderResource` shape, and 404 for any token that does not exist or is not a ULID.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Orders/OrderStatusTest.php`:

```php
<?php

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Str;

test('a guest reads their order with the token', function () {
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    OrderItem::factory()->for($order)->create([
        'item_name' => 'Adobo',
        'size_name' => 'Regular',
        'unit_price' => 18000,
        'quantity' => 2,
        'line_total' => 36000,
    ]);

    $this->getJson("/api/v1/orders/{$order->token}")
        ->assertOk()
        ->assertJsonPath('data.order_number', $order->order_number)
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.status_label', 'Waiting for payment')
        ->assertJsonPath('data.items.0.item_name', 'Adobo')
        ->assertJsonPath('data.total', 36000)
        ->assertJsonMissingPath('data.id');
});

test('a token nobody was given is a 404', function () {
    Order::factory()->create();

    $this->getJson('/api/v1/orders/'.Str::ulid())->assertNotFound();
    $this->getJson('/api/v1/orders/not-a-token')->assertNotFound();
});

test('the guest sees the status the staff set', function () {
    $order = Order::factory()->create();

    // `status` is not fillable: only the staff screens in Module 6 move it,
    // and they will set it the same way.
    $order->status = OrderStatus::Preparing;
    $order->save();

    $this->getJson("/api/v1/orders/{$order->token}")
        ->assertOk()
        ->assertJsonPath('data.status', 'preparing')
        ->assertJsonPath('data.status_label', 'Preparing');
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Orders/OrderStatusTest.php`
Expected: FAIL — 404 on the first test, because the route does not exist.

- [ ] **Step 3: Add the route**

In `routes/api.php`, right after `orders.store`:

```php
Route::get('/orders/{order}', [OrderController::class, 'show'])->name('orders.show');
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Orders/OrderStatusTest.php`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the whole backend suite**

Run: `php artisan test --compact`
Expected: PASS — the 129 earlier tests plus the 22 added here.

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`
Expected: no errors.

---

### Task 5: The cart in the browser

**Files:**

- Create: `resources/js/types/order.ts`
- Create: `resources/js/lib/cart.ts`
- Create: `resources/js/lib/cart-context.ts`
- Create: `resources/js/components/cart/cart-provider.tsx`
- Modify: `resources/js/types/index.ts`
- Test: `resources/js/lib/cart.test.ts`

**Interfaces:**

- Consumes: `MenuCategory`, `MenuItem`, `MenuItemSize` from `@/types`.
- Produces: `Cart = { lines: CartLine[]; table: number | null }` with `CartLine = { itemId: number; sizeId: number; quantity: number; note: string }`; pure helpers `addLine`, `setQuantity`, `setNote`, `removeLine`, `setTable`, `cartCount`, `priceCart`; storage helpers `readCart`, `writeCart`, `clearCart`; constants `MAX_LINES = 30`, `MAX_QUANTITY = 20`, `MAX_NOTE = 120`, `MAX_TABLE = 99`, `CART_MAX_AGE_MS`; `useCart()` returning `{ cart, count, add, setQuantity, setNote, remove, setTable, clear }`; `<CartProvider>`.

- [ ] **Step 1: Write the failing test**

`resources/js/lib/cart.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vite-plus/test';
import {
    addLine,
    cartCount,
    CART_MAX_AGE_MS,
    emptyCart,
    MAX_QUANTITY,
    priceCart,
    readCart,
    removeLine,
    setNote,
    setQuantity,
    setTable,
    writeCart,
} from '@/lib/cart';
import type { MenuCategory } from '@/types';

function fakeStorage() {
    const store = new Map<string, string>();

    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => void store.set(key, value),
            removeItem: (key: string) => void store.delete(key),
        } as unknown as Storage,
    });
}

const menu: MenuCategory[] = [
    {
        id: 1,
        name: 'Meals',
        slug: 'meals',
        description: null,
        sort_order: 0,
        archived_at: null,
        items: [
            {
                id: 10,
                category_id: 1,
                name: 'Adobo',
                description: null,
                image: null,
                is_available: true,
                is_featured: false,
                sort_order: 0,
                archived_at: null,
                sizes: [
                    { id: 100, name: 'Regular', price: 18000 },
                    { id: 101, name: 'Large', price: 24000 },
                ],
            },
            {
                id: 11,
                category_id: 1,
                name: 'Kare-Kare',
                description: null,
                image: null,
                is_available: false,
                is_featured: false,
                sort_order: 1,
                archived_at: null,
                sizes: [{ id: 110, name: 'Regular', price: 26000 }],
            },
        ],
    },
];

beforeEach(fakeStorage);

describe('cart maths', () => {
    it('adds a size once and then counts up', () => {
        const cart = addLine(addLine(emptyCart, 10, 100), 10, 100);

        expect(cart.lines).toHaveLength(1);
        expect(cart.lines[0].quantity).toBe(2);
        expect(cartCount(cart)).toBe(2);
    });

    it('keeps sizes of the same dish apart', () => {
        const cart = addLine(addLine(emptyCart, 10, 100), 10, 101);

        expect(cart.lines).toHaveLength(2);
    });

    it('never goes past the quantity cap', () => {
        const cart = setQuantity(addLine(emptyCart, 10, 100), 100, 999);

        expect(cart.lines[0].quantity).toBe(MAX_QUANTITY);
    });

    it('drops a line at zero and on remove', () => {
        const cart = addLine(emptyCart, 10, 100);

        expect(setQuantity(cart, 100, 0).lines).toHaveLength(0);
        expect(removeLine(cart, 100).lines).toHaveLength(0);
    });

    it('trims a note to the length the kitchen can read', () => {
        const cart = setNote(addLine(emptyCart, 10, 100), 100, 'x'.repeat(200));

        expect(cart.lines[0].note).toHaveLength(120);
    });

    it('takes a table number only when the restaurant has one', () => {
        expect(setTable(emptyCart, 7).table).toBe(7);
        expect(setTable(emptyCart, 0).table).toBeNull();
        expect(setTable(emptyCart, 1000).table).toBeNull();
        expect(setTable(emptyCart, Number.NaN).table).toBeNull();
    });
});

describe('priceCart', () => {
    it('prices lines from the live menu and leaves sold-out dishes out of the total', () => {
        let cart = addLine(emptyCart, 10, 100);
        cart = setQuantity(cart, 100, 2);
        cart = addLine(cart, 11, 110);

        const priced = priceCart(cart, menu);

        expect(priced.lines).toHaveLength(2);
        expect(priced.subtotal).toBe(36000);
        expect(priced.soldOut).toBe(1);
        expect(priced.lines[0].lineTotal).toBe(36000);
        expect(priced.lines[0].item.name).toBe('Adobo');
        expect(priced.lines[0].size.name).toBe('Regular');
    });

    it('forgets lines that left the menu', () => {
        const cart = addLine(emptyCart, 99, 999);

        const priced = priceCart(cart, menu);

        expect(priced.lines).toHaveLength(0);
        expect(priced.dropped).toBe(1);
        expect(priced.subtotal).toBe(0);
    });
});

describe('storage', () => {
    it('reads back what it wrote', () => {
        const cart = setTable(addLine(emptyCart, 10, 100), 7);

        writeCart(cart);

        expect(readCart()).toEqual(cart);
    });

    it('forgets a cart from yesterday', () => {
        writeCart(addLine(emptyCart, 10, 100), 1_000_000);

        expect(readCart(1_000_000 + CART_MAX_AGE_MS + 1)).toEqual(emptyCart);
    });

    it('survives nonsense in storage', () => {
        globalThis.localStorage.setItem('bb.cart', '{not json');

        expect(readCart()).toEqual(emptyCart);
    });
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/cart`.

- [ ] **Step 3: Write `resources/js/types/order.ts` and export it**

```ts
export type OrderType = 'dine_in' | 'takeout';

export type OrderStatus =
    'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid';

export type PaymentMethod = 'counter';

export type OrderLineInput = {
    menu_item_id: number;
    menu_item_size_id: number;
    quantity: number;
    note: string | null;
};

export type PlaceOrderInput = {
    type: OrderType;
    table_number: number | null;
    customer_name: string | null;
    payment_method: PaymentMethod;
    items: OrderLineInput[];
};

export type OrderItem = {
    id: number;
    item_name: string;
    size_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
    note: string | null;
};

export type Order = {
    token: string;
    order_number: string;
    daily_number: number;
    type: OrderType;
    type_label: string;
    table_number: number | null;
    customer_name: string | null;
    status: OrderStatus;
    status_label: string;
    payment_status: PaymentStatus;
    payment_method: PaymentMethod;
    payment_method_label: string;
    subtotal: number;
    total: number;
    placed_at: string | null;
    items: OrderItem[];
};
```

In `resources/js/types/index.ts` add:

```ts
export type * from './order';
```

- [ ] **Step 4: Write `resources/js/lib/cart.ts`**

```ts
import type { MenuCategory, MenuItem, MenuItemSize } from '@/types';

export type CartLine = {
    itemId: number;
    sizeId: number;
    quantity: number;
    note: string;
};

export type Cart = {
    lines: CartLine[];
    table: number | null;
};

export type PricedLine = {
    line: CartLine;
    item: MenuItem;
    size: MenuItemSize;
    lineTotal: number;
};

export type PricedCart = {
    lines: PricedLine[];
    subtotal: number;
    soldOut: number;
    dropped: number;
};

export const CART_KEY = 'bb.cart';
export const MAX_LINES = 30;
export const MAX_QUANTITY = 20;
export const MAX_NOTE = 120;
export const MAX_TABLE = 99;
export const CART_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const VERSION = 1;

export const emptyCart: Cart = { lines: [], table: null };

/** Add one of a size, or raise its quantity when it is already in the order. */
export function addLine(cart: Cart, itemId: number, sizeId: number): Cart {
    const existing = cart.lines.find((line) => line.sizeId === sizeId);

    if (existing) {
        return setQuantity(cart, sizeId, existing.quantity + 1);
    }

    if (cart.lines.length >= MAX_LINES) {
        return cart;
    }

    return {
        ...cart,
        lines: [...cart.lines, { itemId, sizeId, quantity: 1, note: '' }],
    };
}

/** Set a line's quantity. Zero removes the line, and the cap is the kitchen's. */
export function setQuantity(
    cart: Cart,
    sizeId: number,
    quantity: number,
): Cart {
    if (quantity < 1) {
        return removeLine(cart, sizeId);
    }

    return {
        ...cart,
        lines: cart.lines.map((line) =>
            line.sizeId === sizeId
                ? { ...line, quantity: Math.min(quantity, MAX_QUANTITY) }
                : line,
        ),
    };
}

/** Keep a short bilin for the kitchen against a line. */
export function setNote(cart: Cart, sizeId: number, note: string): Cart {
    return {
        ...cart,
        lines: cart.lines.map((line) =>
            line.sizeId === sizeId
                ? { ...line, note: note.slice(0, MAX_NOTE) }
                : line,
        ),
    };
}

export function removeLine(cart: Cart, sizeId: number): Cart {
    return {
        ...cart,
        lines: cart.lines.filter((line) => line.sizeId !== sizeId),
    };
}

/** Remember the table from the QR code, ignoring anything that is not one. */
export function setTable(cart: Cart, table: number | null): Cart {
    const valid =
        table !== null &&
        Number.isInteger(table) &&
        table >= 1 &&
        table <= MAX_TABLE;

    return { ...cart, table: valid ? table : null };
}

export function cartCount(cart: Cart): number {
    return cart.lines.reduce((total, line) => total + line.quantity, 0);
}

/**
 * Join the stored lines with the live menu. Prices always come from the menu
 * that was just loaded, never from storage, and the server prices it again.
 */
export function priceCart(cart: Cart, categories: MenuCategory[]): PricedCart {
    const items = new Map<number, MenuItem>();

    categories.forEach((category) =>
        category.items.forEach((item) => items.set(item.id, item)),
    );

    const lines: PricedLine[] = [];
    let subtotal = 0;
    let soldOut = 0;
    let dropped = 0;

    cart.lines.forEach((line) => {
        const item = items.get(line.itemId);
        const size = item?.sizes.find((entry) => entry.id === line.sizeId);

        if (item === undefined || size === undefined) {
            dropped += 1;

            return;
        }

        const lineTotal = size.price * line.quantity;

        lines.push({ line, item, size, lineTotal });

        if (item.is_available) {
            subtotal += lineTotal;
        } else {
            soldOut += 1;
        }
    });

    return { lines, subtotal, soldOut, dropped };
}

type StoredCart = {
    version: number;
    savedAt: number;
    lines: CartLine[];
    table: number | null;
};

/** The guest's order survives a refresh, but not a night's sleep. */
export function readCart(now = Date.now()): Cart {
    try {
        const raw = globalThis.localStorage?.getItem(CART_KEY);

        if (!raw) {
            return emptyCart;
        }

        const stored = JSON.parse(raw) as Partial<StoredCart>;

        if (
            stored.version !== VERSION ||
            typeof stored.savedAt !== 'number' ||
            now - stored.savedAt > CART_MAX_AGE_MS ||
            !Array.isArray(stored.lines)
        ) {
            return emptyCart;
        }

        const lines = stored.lines
            .filter(
                (line): line is CartLine =>
                    typeof line?.itemId === 'number' &&
                    typeof line?.sizeId === 'number' &&
                    typeof line?.quantity === 'number',
            )
            .slice(0, MAX_LINES)
            .map((line) => ({
                itemId: line.itemId,
                sizeId: line.sizeId,
                quantity: Math.min(
                    Math.max(Math.trunc(line.quantity), 1),
                    MAX_QUANTITY,
                ),
                note:
                    typeof line.note === 'string'
                        ? line.note.slice(0, MAX_NOTE)
                        : '',
            }));

        return setTable(
            { lines, table: null },
            typeof stored.table === 'number' ? stored.table : null,
        );
    } catch {
        return emptyCart;
    }
}

export function writeCart(cart: Cart, now = Date.now()): void {
    try {
        const stored: StoredCart = {
            version: VERSION,
            savedAt: now,
            lines: cart.lines,
            table: cart.table,
        };

        globalThis.localStorage?.setItem(CART_KEY, JSON.stringify(stored));
    } catch {
        // A blocked or full store only costs the guest their saved order.
    }
}

export function clearCart(): void {
    try {
        globalThis.localStorage?.removeItem(CART_KEY);
    } catch {
        // Nothing to clean up if the store is not there.
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — the new `cart.test.ts` (11 tests) plus the existing money and photo tests.

- [ ] **Step 6: Write the context and the provider**

`resources/js/lib/cart-context.ts`:

```ts
import { createContext, use } from 'react';
import type { Cart } from '@/lib/cart';

export type CartContextValue = {
    cart: Cart;
    count: number;
    add: (itemId: number, sizeId: number) => void;
    setQuantity: (sizeId: number, quantity: number) => void;
    setNote: (sizeId: number, note: string) => void;
    remove: (sizeId: number) => void;
    setTable: (table: number | null) => void;
    clear: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

/** The order the guest is building. Only usable inside <CartProvider>. */
export function useCart(): CartContextValue {
    const value = use(CartContext);

    if (value === null) {
        throw new Error('useCart must be used inside a CartProvider.');
    }

    return value;
}
```

`resources/js/components/cart/cart-provider.tsx`:

```tsx
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
    addLine,
    type Cart,
    cartCount,
    clearCart,
    emptyCart,
    readCart,
    removeLine,
    setNote as setLineNote,
    setQuantity as setLineQuantity,
    setTable as setCartTable,
    writeCart,
} from '@/lib/cart';
import { CartContext, type CartContextValue } from '@/lib/cart-context';

export function CartProvider({ children }: { children: ReactNode }) {
    const [cart, setCart] = useState<Cart>(() => readCart());
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        writeCart(cart);
    }, [cart]);

    // A table QR arrives as ?table=7: remember it, then tidy the address bar.
    useEffect(() => {
        const raw = searchParams.get('table');

        if (raw === null) {
            return;
        }

        setCart((current) => setCartTable(current, Number.parseInt(raw, 10)));

        const next = new URLSearchParams(searchParams);
        next.delete('table');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const value = useMemo<CartContextValue>(
        () => ({
            cart,
            count: cartCount(cart),
            add: (itemId, sizeId) =>
                setCart((current) => addLine(current, itemId, sizeId)),
            setQuantity: (sizeId, quantity) =>
                setCart((current) =>
                    setLineQuantity(current, sizeId, quantity),
                ),
            setNote: (sizeId, note) =>
                setCart((current) => setLineNote(current, sizeId, note)),
            remove: (sizeId) =>
                setCart((current) => removeLine(current, sizeId)),
            setTable: (table) =>
                setCart((current) => setCartTable(current, table)),
            clear: () => {
                clearCart();
                setCart(emptyCart);
            },
        }),
        [cart],
    );

    return <CartContext value={value}>{children}</CartContext>;
}
```

- [ ] **Step 7: Check types and lint**

Run: `npm run types:check`
Run: `npm run check`
Expected: no errors. (If the React 19 context-as-provider form is rejected, use `<CartContext.Provider value={value}>`.)

---

### Task 6: Adding to the cart from the menu

**Files:**

- Create: `resources/js/components/public/menu-row.tsx`
- Create: `resources/js/components/cart/order-bar.tsx`
- Modify: `resources/js/pages/menu.tsx`
- Modify: `resources/js/layouts/public-layout.tsx`
- Modify: `resources/js/router.tsx` (move the menu loader onto the layout route, id `public`)
- Modify: `resources/css/app.css` (the `.plate-lift` animation)
- Modify: `resources/views/app.blade.php` (`viewport-fit=cover`)

**Interfaces:**

- Consumes: `useCart()` and `priceCart` from Task 5, `Plate`, `formatPeso`.
- Produces: `<MenuRow item={item} />`, `<OrderBar />`, and the loader id `public` so any public page can read the menu with `useRouteLoaderData<typeof publicMenuLoader>('public')`.

- [ ] **Step 1: Move the menu loader onto the layout route**

In `resources/js/router.tsx`, replace the public branch with:

```tsx
    {
        id: 'public',
        element: <PublicLayout />,
        errorElement: <RouteError />,
        loader: publicMenuLoader,
        children: [
            { path: '/', element: <Home /> },
            { path: '/menu', element: <Menu /> },
            { path: '*', element: <NotFound /> },
        ],
    },
```

In `resources/js/pages/home.tsx` and `resources/js/pages/menu.tsx`, swap the loader hook:

```tsx
import { useRouteLoaderData } from 'react-router';
// ...
const categories = useRouteLoaderData<typeof publicMenuLoader>('public') ?? [];
```

- [ ] **Step 2: Add the lift animation to `resources/css/app.css`**

Inside `@layer components`, next to `.plate-sold-out`:

```css
@media (prefers-reduced-motion: no-preference) {
    .plate-lift {
        animation: plate-lift 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
}
```

and next to `@keyframes serve`:

```css
@keyframes plate-lift {
    50% {
        transform: translateY(-0.9rem) rotate(-6deg) scale(1.05);
    }
}
```

- [ ] **Step 3: Write `resources/js/components/public/menu-row.tsx`**

```tsx
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Plate } from '@/components/public/plate';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-context';
import { formatPeso } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

/** One dish on the menu: its plate, its copy, and a button per size. */
export function MenuRow({ item }: { item: MenuItem }) {
    const { add } = useCart();
    const [lifting, setLifting] = useState(false);

    function handleAdd(sizeId: number) {
        add(item.id, sizeId);
        setLifting(true);
    }

    return (
        <li className="flex items-start gap-4">
            <div
                className={cn('shrink-0', lifting && 'plate-lift')}
                onAnimationEnd={() => setLifting(false)}
            >
                <Plate item={item} size="menu" />
            </div>

            <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-lg leading-snug font-semibold">
                    {item.name}
                </h3>

                {item.description && (
                    <p className="line-clamp-3 text-muted-foreground">
                        {item.description}
                    </p>
                )}

                {item.is_available ? (
                    <ul className="flex flex-wrap gap-2">
                        {item.sizes.map((size) => (
                            <li key={size.id}>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="min-h-11 rounded-full font-display font-extrabold"
                                    aria-label={`Add ${item.name}${item.sizes.length > 1 ? `, ${size.name},` : ''} for ${formatPeso(size.price)}`}
                                    onClick={() => handleAdd(size.id)}
                                >
                                    <Plus aria-hidden="true" />
                                    {item.sizes.length > 1 && (
                                        <span className="font-sans font-medium">
                                            {size.name}
                                        </span>
                                    )}
                                    {formatPeso(size.price)}
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="font-semibold text-achuete">Sold out today</p>
                )}
            </div>
        </li>
    );
}
```

- [ ] **Step 4: Use it in `resources/js/pages/menu.tsx`**

Replace the `<li>…</li>` body inside the items `<ul>` with:

```tsx
{
    category.items.map((item) => <MenuRow key={item.id} item={item} />);
}
```

and drop the now-unused `Plate` and `PriceList` imports from that page. (`PriceList` stays in use on the home page.)

- [ ] **Step 5: Write `resources/js/components/cart/order-bar.tsx`**

```tsx
import { Link, useLocation, useRouteLoaderData } from 'react-router';
import { priceCart } from '@/lib/cart';
import { useCart } from '@/lib/cart-context';
import { formatPeso } from '@/lib/money';
import type { publicMenuLoader } from '@/lib/public-menu';

/** The running order, always one tap from checkout. */
export function OrderBar() {
    const { cart } = useCart();
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('public') ?? [];
    const { pathname } = useLocation();
    const { lines, subtotal } = priceCart(cart, categories);
    const count = lines.reduce(
        (total, priced) => total + priced.line.quantity,
        0,
    );

    if (count === 0 || pathname === '/cart') {
        return null;
    }

    return (
        <>
            <div aria-hidden="true" className="h-24" />
            <div className="fixed inset-x-0 bottom-0 z-20 bg-dahon text-pandan">
                <div className="wrapper flex items-center justify-between gap-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <p aria-live="polite" className="font-medium">
                        {count} {count === 1 ? 'item' : 'items'} ·{' '}
                        <span className="font-display font-extrabold">
                            {formatPeso(subtotal)}
                        </span>
                    </p>
                    <Link
                        to="/cart"
                        className="inline-flex min-h-11 items-center rounded-full bg-achuete px-5 font-semibold text-white"
                    >
                        Review order
                    </Link>
                </div>
            </div>
        </>
    );
}
```

- [ ] **Step 6: Wire the provider and the bar into `resources/js/layouts/public-layout.tsx`**

Wrap everything the layout renders in `<CartProvider>`, and put `<OrderBar />` at the end of `<main>`:

```tsx
export default function PublicLayout() {
    return (
        <CartProvider>
            <div className="flex min-h-svh flex-col bg-pandan text-uling">
                {/* skip link, header, nav — unchanged */}

                <main id="content" className="flex-1">
                    <Outlet />
                    <OrderBar />
                </main>

                {/* footer and ScrollRestoration — unchanged */}
            </div>
        </CartProvider>
    );
}
```

- [ ] **Step 7: Let the safe area work in `resources/views/app.blade.php`**

```blade
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- [ ] **Step 8: Verify**

Run: `npm run types:check`
Run: `npm run check`
Run: `npm test`
Expected: all pass.

Then ask the user to open `http://localhost:8000/menu?table=7` with `composer run dev` running, tap a few add buttons, and confirm the plate lifts, the bottom bar counts up, and `?table=7` disappears from the address bar.

---

### Task 7: The cart and checkout page

**Files:**

- Create: `resources/js/lib/orders.ts`
- Create: `resources/js/components/cart/quantity-stepper.tsx`
- Create: `resources/js/pages/cart.tsx`
- Modify: `resources/js/router.tsx` (add `/cart`)
- Test: `resources/js/lib/orders.test.ts`

**Interfaces:**

- Consumes: `priceCart`, `useCart`, `HttpError`, `formatPeso`, `PlaceOrderInput`, `Order`.
- Produces: `placeOrder(input: PlaceOrderInput): Promise<Order>`, `fetchOrder(token: string): Promise<Order>`, `orderLoader({ params }): Promise<Order>`, `rememberOrder(token, now?)`, `recentOrder(now?): string | null`, `forgetOrder()`, `<QuantityStepper value label onChange />`, and the `/cart` route.

- [ ] **Step 1: Write the failing test**

`resources/js/lib/orders.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vite-plus/test';
import {
    forgetOrder,
    recentOrder,
    RECENT_ORDER_MAX_AGE_MS,
    rememberOrder,
} from '@/lib/orders';

beforeEach(() => {
    const store = new Map<string, string>();

    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => void store.set(key, value),
            removeItem: (key: string) => void store.delete(key),
        } as unknown as Storage,
    });
});

describe('recent order', () => {
    it('remembers the order the guest just placed', () => {
        rememberOrder('01JB8ZQ3K7WY5S9T2V4XRD6M8N', 1_000);

        expect(recentOrder(1_000)).toBe('01JB8ZQ3K7WY5S9T2V4XRD6M8N');
    });

    it('lets go after the meal is long over', () => {
        rememberOrder('01JB8ZQ3K7WY5S9T2V4XRD6M8N', 1_000);

        expect(recentOrder(1_000 + RECENT_ORDER_MAX_AGE_MS + 1)).toBeNull();
    });

    it('forgets on request and ignores nonsense', () => {
        rememberOrder('01JB8ZQ3K7WY5S9T2V4XRD6M8N', 1_000);
        forgetOrder();

        expect(recentOrder(1_000)).toBeNull();

        globalThis.localStorage.setItem('bb.order', 'not json');

        expect(recentOrder(1_000)).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/orders`.

- [ ] **Step 3: Write `resources/js/lib/orders.ts`**

```ts
import type { LoaderFunctionArgs } from 'react-router';
import { http } from '@/lib/http';
import type { Order, PlaceOrderInput } from '@/types';

type Wrapped<T> = { data: T };

export const RECENT_ORDER_KEY = 'bb.order';
export const RECENT_ORDER_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
    const response = await http.post<Wrapped<Order>>('/api/v1/orders', input);

    return response.data;
}

export async function fetchOrder(token: string): Promise<Order> {
    const response = await http.get<Wrapped<Order>>(`/api/v1/orders/${token}`);

    return response.data;
}

/** Loader: the order behind /order/:token. */
export function orderLoader({ params }: LoaderFunctionArgs): Promise<Order> {
    return fetchOrder(String(params.token));
}

type StoredOrder = { token: string; savedAt: number };

/** Keep the last order within reach while the guest is still eating. */
export function rememberOrder(token: string, now = Date.now()): void {
    try {
        const stored: StoredOrder = { token, savedAt: now };

        globalThis.localStorage?.setItem(
            RECENT_ORDER_KEY,
            JSON.stringify(stored),
        );
    } catch {
        // Without storage the guest simply loses the shortcut.
    }
}

export function recentOrder(now = Date.now()): string | null {
    try {
        const raw = globalThis.localStorage?.getItem(RECENT_ORDER_KEY);

        if (!raw) {
            return null;
        }

        const stored = JSON.parse(raw) as Partial<StoredOrder>;

        if (
            typeof stored.token !== 'string' ||
            typeof stored.savedAt !== 'number' ||
            now - stored.savedAt > RECENT_ORDER_MAX_AGE_MS
        ) {
            return null;
        }

        return stored.token;
    } catch {
        return null;
    }
}

export function forgetOrder(): void {
    try {
        globalThis.localStorage?.removeItem(RECENT_ORDER_KEY);
    } catch {
        // Nothing to clean up if the store is not there.
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (3 new tests).

- [ ] **Step 5: Write `resources/js/components/cart/quantity-stepper.tsx`**

```tsx
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_QUANTITY } from '@/lib/cart';

type QuantityStepperProps = {
    value: number;
    label: string;
    onChange: (value: number) => void;
};

export function QuantityStepper({
    value,
    label,
    onChange,
}: QuantityStepperProps) {
    return (
        <div className="flex items-center gap-1">
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 rounded-full"
                aria-label={`One less ${label}`}
                onClick={() => onChange(value - 1)}
            >
                <Minus aria-hidden="true" />
            </Button>

            <output
                className="w-10 text-center font-display text-lg font-extrabold"
                aria-label={`${value} ${label}`}
            >
                {value}
            </output>

            <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 rounded-full"
                aria-label={`One more ${label}`}
                disabled={value >= MAX_QUANTITY}
                onClick={() => onChange(value + 1)}
            >
                <Plus aria-hidden="true" />
            </Button>
        </div>
    );
}
```

- [ ] **Step 6: Write `resources/js/pages/cart.tsx`**

```tsx
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useRouteLoaderData } from 'react-router';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { Plate } from '@/components/public/plate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { restaurant } from '@/content/restaurant';
import { priceCart } from '@/lib/cart';
import { useCart } from '@/lib/cart-context';
import { HttpError, type ValidationErrors } from '@/lib/http';
import { formatPeso } from '@/lib/money';
import { placeOrder, rememberOrder } from '@/lib/orders';
import type { publicMenuLoader } from '@/lib/public-menu';
import { cn } from '@/lib/utils';
import type { OrderType } from '@/types';

export default function Cart() {
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('public') ?? [];
    const { cart, setQuantity, setNote, remove, setTable, clear } = useCart();
    const navigate = useNavigate();

    const [type, setType] = useState<OrderType>('dine_in');
    const [name, setName] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [message, setMessage] = useState<string | null>(null);
    const [placing, setPlacing] = useState(false);

    const { lines, subtotal, soldOut } = priceCart(cart, categories);
    const error = (field: string) => errors[field]?.[0];

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrors({});
        setMessage(null);
        setPlacing(true);

        try {
            const order = await placeOrder({
                type,
                table_number: type === 'dine_in' ? cart.table : null,
                customer_name: type === 'takeout' ? name.trim() : null,
                payment_method: 'counter',
                items: lines.map(({ line }) => ({
                    menu_item_id: line.itemId,
                    menu_item_size_id: line.sizeId,
                    quantity: line.quantity,
                    note: line.note.trim() === '' ? null : line.note.trim(),
                })),
            });

            rememberOrder(order.token);
            clear();
            navigate(`/order/${order.token}`);
        } catch (failure) {
            if (failure instanceof HttpError) {
                setErrors(failure.errors);
                setMessage(
                    failure.status === 429
                        ? 'That is a lot of orders in one minute. Please wait a moment and try again.'
                        : (failure.body.message ??
                              'We could not place your order. Please try again.'),
                );
            } else {
                setMessage(
                    'We could not reach the kitchen. Check your connection and try again.',
                );
            }

            setPlacing(false);
        }
    }

    if (lines.length === 0) {
        return (
            <>
                <title>{`Your order | ${restaurant.name}`}</title>
                <div className="wrapper flex flex-col items-start gap-4 py-20">
                    <h1 className="font-display text-4xl font-extrabold tracking-tight">
                        Your order is empty.
                    </h1>
                    <p className="text-lg">Pick something from today's menu.</p>
                    <Link
                        to="/menu"
                        className="text-lg underline underline-offset-4"
                    >
                        See the menu
                    </Link>
                </div>
            </>
        );
    }

    return (
        <>
            <title>{`Your order | ${restaurant.name}`}</title>

            <form
                onSubmit={handleSubmit}
                className="wrapper flex flex-col gap-8 py-10"
            >
                <h1 className="font-display text-4xl font-extrabold tracking-tight">
                    Your order
                </h1>

                <ul className="flex flex-col divide-y divide-border">
                    {lines.map(({ line, item, size, lineTotal }, index) => (
                        <li
                            key={line.sizeId}
                            className="flex flex-col gap-3 py-5"
                        >
                            <div className="flex items-start gap-4">
                                <Plate item={item} size="menu" />

                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <h2 className="text-lg font-semibold">
                                        {item.name}
                                    </h2>
                                    <p className="text-muted-foreground">
                                        {item.sizes.length > 1 &&
                                            `${size.name} · `}
                                        {formatPeso(size.price)} each
                                    </p>

                                    {!item.is_available && (
                                        <p className="font-semibold text-achuete">
                                            Sold out today — remove it to carry
                                            on.
                                        </p>
                                    )}

                                    {error(
                                        `items.${index}.menu_item_size_id`,
                                    ) && (
                                        <p className="font-semibold text-destructive">
                                            {error(
                                                `items.${index}.menu_item_size_id`,
                                            )}
                                        </p>
                                    )}
                                </div>

                                <p className="font-display text-lg font-extrabold">
                                    {formatPeso(lineTotal)}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <QuantityStepper
                                    value={line.quantity}
                                    label={item.name}
                                    onChange={(quantity) =>
                                        setQuantity(line.sizeId, quantity)
                                    }
                                />

                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="min-h-11"
                                    onClick={() => remove(line.sizeId)}
                                >
                                    Remove
                                </Button>
                            </div>

                            <div className="grid gap-2">
                                <Label
                                    htmlFor={`note-${line.sizeId}`}
                                    className="sr-only"
                                >
                                    {`Note for ${item.name}`}
                                </Label>
                                <Input
                                    id={`note-${line.sizeId}`}
                                    value={line.note}
                                    maxLength={120}
                                    placeholder="Note for the kitchen (optional)"
                                    onChange={(event) =>
                                        setNote(line.sizeId, event.target.value)
                                    }
                                />
                            </div>
                        </li>
                    ))}
                </ul>

                <fieldset className="flex flex-col gap-3">
                    <legend className="mb-2 font-display text-xl font-extrabold">
                        Where are you eating?
                    </legend>

                    <div role="group" className="grid grid-cols-2 gap-3">
                        {(['dine_in', 'takeout'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                aria-pressed={type === option}
                                onClick={() => setType(option)}
                                className={cn(
                                    'min-h-14 rounded-xl border-2 px-4 font-semibold',
                                    type === option
                                        ? 'border-dahon bg-dahon text-pandan'
                                        : 'border-border bg-card',
                                )}
                            >
                                {option === 'dine_in' ? 'Dine in' : 'Take out'}
                            </button>
                        ))}
                    </div>

                    {type === 'dine_in' ? (
                        <div className="grid gap-2">
                            <Label htmlFor="table">Table number</Label>
                            <Input
                                id="table"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={cart.table ?? ''}
                                aria-invalid={
                                    error('table_number') ? true : undefined
                                }
                                aria-describedby={
                                    error('table_number')
                                        ? 'table-error'
                                        : 'table-hint'
                                }
                                onChange={(event) => {
                                    const value = event.target.value.trim();

                                    setTable(
                                        value === ''
                                            ? null
                                            : Number.parseInt(value, 10),
                                    );
                                }}
                            />
                            {error('table_number') ? (
                                <p
                                    id="table-error"
                                    className="text-sm text-destructive"
                                >
                                    {error('table_number')}
                                </p>
                            ) : (
                                <p
                                    id="table-hint"
                                    className="text-sm text-muted-foreground"
                                >
                                    It is printed on the QR card on your table.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                maxLength={40}
                                autoComplete="given-name"
                                aria-invalid={
                                    error('customer_name') ? true : undefined
                                }
                                aria-describedby={
                                    error('customer_name')
                                        ? 'name-error'
                                        : undefined
                                }
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                            />
                            {error('customer_name') && (
                                <p
                                    id="name-error"
                                    className="text-sm text-destructive"
                                >
                                    {error('customer_name')}
                                </p>
                            )}
                        </div>
                    )}
                </fieldset>

                <div className="rounded-xl border-2 border-dahon bg-card p-4">
                    <p className="font-display text-xl font-extrabold">
                        Pay at the counter
                    </p>
                    <p className="text-muted-foreground">
                        Place the order, then pay at the counter. The kitchen
                        starts once it is paid.
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                    <p className="font-display text-2xl font-extrabold">
                        Total {formatPeso(subtotal)}
                    </p>

                    <Button
                        type="submit"
                        size="lg"
                        className="min-h-14 rounded-full px-8 text-lg"
                        disabled={placing || soldOut > 0}
                    >
                        {placing ? 'Placing…' : 'Place order'}
                    </Button>
                </div>

                {message && (
                    <p role="alert" className="font-semibold text-destructive">
                        {message}
                    </p>
                )}
            </form>
        </>
    );
}
```

- [ ] **Step 7: Add the route**

In `resources/js/router.tsx`, inside the `public` children:

```tsx
            { path: '/cart', element: <Cart /> },
```

with `import Cart from '@/pages/cart';` at the top.

- [ ] **Step 8: Verify**

Run: `npm run types:check`
Run: `npm run check`
Run: `npm test`
Expected: all pass.

---

### Task 8: The order status page

**Files:**

- Create: `resources/js/lib/order-polling.ts`
- Create: `resources/js/pages/order-status.tsx`
- Create: `resources/js/components/cart/recent-order-link.tsx`
- Modify: `resources/js/router.tsx` (add `/order/:token`)
- Modify: `resources/js/layouts/public-layout.tsx` (the header link)

**Interfaces:**

- Consumes: `orderLoader`, `fetchOrder`, `rememberOrder`, `recentOrder` from Task 7; `Order`, `OrderStatus` types.
- Produces: `useOrderUpdates(initial: Order): Order` (polls every 15s while the tab is visible and the order is still open), `<RecentOrderLink />`, and the `/order/:token` route.

- [ ] **Step 1: Write `resources/js/lib/order-polling.ts`**

```ts
import { useEffect, useState } from 'react';
import { fetchOrder } from '@/lib/orders';
import type { Order } from '@/types';

export const POLL_INTERVAL_MS = 15_000;

/**
 * Keep an order fresh while the guest is watching it. The poll pauses with the
 * tab hidden and stops for good once the order is finished, so a restaurant
 * full of phones behind one router stays inside the rate limit.
 */
export function useOrderUpdates(initial: Order): Order {
    const [order, setOrder] = useState(initial);

    useEffect(() => {
        setOrder(initial);
    }, [initial]);

    useEffect(() => {
        if (order.status === 'completed' || order.status === 'cancelled') {
            return;
        }

        let stopped = false;

        const timer = window.setInterval(() => {
            if (document.hidden) {
                return;
            }

            fetchOrder(order.token)
                .then((fresh) => {
                    if (!stopped) {
                        setOrder(fresh);
                    }
                })
                .catch(() => undefined);
        }, POLL_INTERVAL_MS);

        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [order.token, order.status]);

    return order;
}
```

- [ ] **Step 2: Write `resources/js/pages/order-status.tsx`**

```tsx
import { useEffect } from 'react';
import { Link, useLoaderData } from 'react-router';
import { restaurant } from '@/content/restaurant';
import { formatPeso } from '@/lib/money';
import { useOrderUpdates } from '@/lib/order-polling';
import { type orderLoader, rememberOrder } from '@/lib/orders';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

const steps: { status: OrderStatus; label: string }[] = [
    { status: 'pending', label: 'Placed' },
    { status: 'confirmed', label: 'Paid' },
    { status: 'preparing', label: 'Cooking' },
    { status: 'ready', label: 'Ready' },
    { status: 'completed', label: 'Served' },
];

export default function OrderStatus() {
    const initial = useLoaderData<typeof orderLoader>();
    const order = useOrderUpdates(initial);
    const current = steps.findIndex((step) => step.status === order.status);

    useEffect(() => {
        rememberOrder(order.token);
    }, [order.token]);

    return (
        <>
            <title>{`Order ${order.order_number} | ${restaurant.name}`}</title>

            <div className="wrapper flex flex-col gap-8 py-10">
                <header className="flex flex-col gap-1">
                    <p className="text-lg text-muted-foreground">Your number</p>
                    <p className="font-display text-[clamp(4rem,2rem+12vw,8rem)] leading-none font-extrabold tracking-tight">
                        {String(order.daily_number).padStart(4, '0')}
                    </p>
                    <p className="text-muted-foreground">
                        {order.order_number}
                    </p>
                </header>

                {order.status === 'cancelled' ? (
                    <p className="rounded-xl border-2 border-destructive bg-card p-4 font-semibold text-destructive">
                        This order was cancelled. Talk to the counter if that is
                        a surprise.
                    </p>
                ) : (
                    order.payment_status === 'unpaid' && (
                        <p className="rounded-xl border-2 border-achuete bg-card p-4">
                            <span className="font-display text-xl font-extrabold">
                                Pay at the counter.
                            </span>{' '}
                            Show this number and the kitchen starts right after.
                        </p>
                    )
                )}

                {order.status !== 'cancelled' && (
                    <ol className="flex flex-wrap gap-2">
                        {steps.map((step, index) => (
                            <li
                                key={step.status}
                                aria-current={
                                    index === current ? 'step' : undefined
                                }
                                className={cn(
                                    'rounded-full border px-4 py-2 font-medium',
                                    index < current &&
                                        'border-dahon text-dahon',
                                    index === current &&
                                        'border-dahon bg-dahon font-semibold text-pandan',
                                    index > current &&
                                        'border-border text-muted-foreground',
                                )}
                            >
                                {step.label}
                            </li>
                        ))}
                    </ol>
                )}

                <dl className="grid grid-cols-[auto_auto] justify-start gap-x-6 gap-y-1">
                    <dt className="text-muted-foreground">Order</dt>
                    <dd className="font-medium">{order.type_label}</dd>

                    {order.table_number !== null && (
                        <>
                            <dt className="text-muted-foreground">Table</dt>
                            <dd className="font-medium">
                                {order.table_number}
                            </dd>
                        </>
                    )}

                    {order.customer_name !== null && (
                        <>
                            <dt className="text-muted-foreground">Name</dt>
                            <dd className="font-medium">
                                {order.customer_name}
                            </dd>
                        </>
                    )}

                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium">{order.status_label}</dd>
                </dl>

                <ul className="flex flex-col divide-y divide-border border-y border-border">
                    {order.items.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-start gap-4 py-4"
                        >
                            <p className="font-display text-lg font-extrabold">
                                {item.quantity}×
                            </p>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <p className="font-semibold">
                                    {item.item_name}
                                    <span className="font-normal text-muted-foreground">
                                        {` · ${item.size_name}`}
                                    </span>
                                </p>
                                {item.note && (
                                    <p className="text-muted-foreground">
                                        {item.note}
                                    </p>
                                )}
                            </div>
                            <p className="font-display font-extrabold">
                                {formatPeso(item.line_total)}
                            </p>
                        </li>
                    ))}
                </ul>

                <p className="font-display text-2xl font-extrabold">
                    Total {formatPeso(order.total)}
                </p>

                <Link
                    to="/menu"
                    className="text-lg underline underline-offset-4"
                >
                    Back to the menu
                </Link>
            </div>
        </>
    );
}
```

- [ ] **Step 3: Write `resources/js/components/cart/recent-order-link.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { recentOrder } from '@/lib/orders';

/** A way back to the order the guest placed, for as long as it is theirs. */
export function RecentOrderLink() {
    const { pathname } = useLocation();
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        setToken(recentOrder());
    }, [pathname]);

    if (token === null || pathname.startsWith('/order/')) {
        return null;
    }

    return (
        <Link
            to={`/order/${token}`}
            className="inline-flex min-h-11 items-center rounded-md px-3 font-medium underline-offset-4 hover:underline"
        >
            Your order
        </Link>
    );
}
```

Render it in `resources/js/layouts/public-layout.tsx`, as the last item of the header nav list:

```tsx
<li>
    <RecentOrderLink />
</li>
```

- [ ] **Step 4: Add the route**

In `resources/js/router.tsx`, inside the `public` children:

```tsx
            {
                path: '/order/:token',
                loader: orderLoader,
                element: <OrderStatus />,
                errorElement: <RouteError />,
            },
```

with `import OrderStatus from '@/pages/order-status';` and `import { orderLoader } from '@/lib/orders';`.

- [ ] **Step 5: Verify**

Run: `npm run types:check`
Run: `npm run check`
Run: `npm test`
Run: `npm run build`
Expected: all pass, and the build stays under the 500 kB warning.

---

### Task 9: Module gate

**Files:** none — this task only runs checks and commits.

- [ ] **Step 1: Run every automated check**

Run: `php artisan test --compact`
Run: `composer types:check`
Run: `vendor/bin/pint --test --parallel` (via `composer lint:check`)
Run: `npm test`
Run: `npm run types:check`
Run: `npm run check`
Run: `npm run build`
Expected: all green.

- [ ] **Step 2: Confirm the routes are shaped as planned**

Run: `php artisan route:list --path=api/v1/orders --except-vendor`
Expected: `POST api/v1/orders` with `throttle:orders`, and `GET api/v1/orders/{order}`.

- [ ] **Step 3: Grep for the security invariants**

Run: `grep -rn "unit_price\|subtotal" app/Http/Requests`
Expected: no match — no money ever arrives from the browser.

Run: `grep -rn "\$request->all()" app`
Expected: no match.

- [ ] **Step 4: User browser walkthrough**

Ask the user, with `composer run dev` running:

1. Open `http://localhost:8000/menu?table=7`, add two dishes, and watch the plate lift and the bottom bar count.
2. Open the bottom bar, change a quantity, type a note, and place the order.
3. On the status screen, check the big number, the "Pay at the counter" card, and the steps.
4. In a second tab, open `/admin/menu` as staff and mark that dish sold out; back on the cart page, reload — the line should say "Sold out today" and the button should refuse to submit.
5. Widths 320, 375, 768, 1280 and 1920: no horizontal scrolling, and the bottom bar never covers the last row.

- [ ] **Step 5: Production CSP check**

Ask the user to stop the dev server and run `Remove-Item public/hot`, `npm run build`, `php artisan serve`, then walk `/`, `/menu`, `/cart` and `/order/{token}` with the console open. Expected: no `Refused to…` messages.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: guest cart, checkout and order tracking"
```
