# Module 6 — Orders Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the staff the two screens the restaurant actually runs on — a cashier queue and a kitchen display — with every status change checked against the state machine and against who is asking.

**Architecture:** One state machine lives on `OrderStatus` (`allowedNext()`), one service applies a move (`OrderTransitioner`), and one policy decides who may make it. The screens are plain React pages that poll a single staff listing endpoint while their tab is visible; no websockets, no new dependencies.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5, PHPStan level 7 (Larastan), Pint, React 19, React Router 8, Tailwind 4, Vitest, Web Audio API for the kitchen chime.

**Spec:** `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md` (§5 Order State Machine, §6 Security Layers)

## Global Constraints

- **The state machine is the spec's:** `pending → confirmed → preparing → ready → completed`, with `cancelled` reachable from `pending`. No skipping and no going back.
- **`confirmed` is written by payment alone.** The staff status endpoint refuses it outright; `PaymentConfirmer` (Module 5) remains the only writer.
- **The kitchen only ever sees paid orders.** (spec §5: "Kitchen sees it: once `confirmed`")
- Authorization in three layers as the spec sets out: route middleware for the group, the policy for who, and the service for what the order's own state allows — because `Gate::before` lets an admin past the policy. (spec §6)
- Every status change writes an audit row with the causer, the previous status and, for a cancellation, the reason. (spec §6)
- Brainstorming decisions (2026-09-23): **kitchen marks Ready, the counter marks Completed**; the kitchen display is **three columns** (New · Cooking · Ready) that stack on a phone; a **chime with a mute toggle** on new paid orders; **only unpaid orders may be cancelled**, by Cashier or Admin.
- Polling, not websockets: every 5s in the kitchen, every 7s at the counter, paused while the tab is hidden.
- Money stays integer centavos; guests and staff both address an order by its ULID token, never by id.
- After every PHP edit run `vendor/bin/pint --dirty --format agent`.
- Commands the **user** runs: installs, migrations and `git commit`. This module adds **no migration**.

## File Structure

**Backend**

| File                                                   | Responsibility                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `app/Enums/OrderStatus.php`                            | _Modify:_ `allowedNext()` — the state machine itself            |
| `app/Policies/OrderPolicy.php`                         | _Modify:_ `viewAny`, `transition`, `manageOrders`, `cookOrders` |
| `app/Services/OrderTransitioner.php`                   | Applies one move, or refuses it with a readable reason          |
| `app/Http/Requests/Admin/UpdateOrderStatusRequest.php` | `status` (never `confirmed`) and an optional `reason`           |
| `app/Http/Requests/Admin/ListStaffOrdersRequest.php`   | `view`: `queue`, `kitchen` or `done`                            |
| `app/Http/Controllers/Admin/OrderStatusController.php` | `PATCH /orders/{token}/status`                                  |
| `app/Http/Controllers/Admin/StaffOrderController.php`  | `GET /staff/orders`                                             |
| `app/Http/Resources/StaffOrderResource.php`            | The staff's view: notes, waiting time, who paid                 |
| `app/Http/Controllers/CurrentUserController.php`       | _Modify:_ `manage_orders`, `cook_orders`                        |
| `routes/api.php`                                       | The two staff routes                                            |

**Frontend**

| File                                         | Responsibility                                             |
| -------------------------------------------- | ---------------------------------------------------------- |
| `resources/js/types/order.ts`                | _Modify:_ `StaffOrder`, `OpsView`                          |
| `resources/js/lib/ops.ts`                    | Listing, transitions, loaders, `elapsedLabel`, `newTokens` |
| `resources/js/lib/ops-polling.ts`            | `useStaffOrders` — refresh while the tab is visible        |
| `resources/js/lib/chime.ts`                  | A short beep made in the browser, and the mute switch      |
| `resources/js/components/ops/order-card.tsx` | One order, as both screens show it                         |
| `resources/js/pages/admin/orders.tsx`        | Cashier queue, with a "done today" tab                     |
| `resources/js/pages/admin/kitchen.tsx`       | Three columns, chime, mute                                 |
| `resources/js/layouts/admin-layout.tsx`      | _Modify:_ Orders and Kitchen links                         |
| `resources/js/router.tsx`                    | _Modify:_ `/admin/orders`, `/admin/kitchen`                |

**Tests**

| File                                            | Covers                                    |
| ----------------------------------------------- | ----------------------------------------- |
| `tests/Feature/Ops/OrderTransitionTest.php`     | The machine: legal moves, refusals, audit |
| `tests/Feature/Ops/OrderStatusEndpointTest.php` | Who may move what, and the 422s           |
| `tests/Feature/Ops/StaffOrderListTest.php`      | The three views, ordering, today only     |
| `resources/js/lib/ops.test.ts`                  | `elapsedLabel`, `newTokens`               |

---

### Task 1: The state machine and who may move it

**Files:**

- Modify: `app/Enums/OrderStatus.php`, `app/Policies/OrderPolicy.php`
- Create: `app/Services/OrderTransitioner.php`
- Test: `tests/Feature/Ops/OrderTransitionTest.php`

**Interfaces:**

- Produces: `OrderStatus::allowedNext(): list<OrderStatus>`; `OrderTransitioner::move(Order $order, OrderStatus $to, User $staff, ?string $reason = null): Order` (throws `ValidationException`); `OrderPolicy::transition(User $user, Order $order, OrderStatus $to): bool`, `viewAny(User): bool`, `manageOrders(User): bool`, `cookOrders(User): bool`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Ops/OrderTransitionTest.php`:

```php
<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderTransitioner;
use Illuminate\Validation\ValidationException;

function move(Order $order, OrderStatus $to, ?User $staff = null, ?string $reason = null): Order
{
    return app(OrderTransitioner::class)->move(
        $order,
        $to,
        $staff ?? User::factory()->admin()->create(),
        $reason,
    );
}

function orderAt(OrderStatus $status, PaymentStatus $payment = PaymentStatus::Paid): Order
{
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    $order->status = $status;
    $order->payment_status = $payment;
    $order->save();

    return $order;
}

test('an order walks the line from confirmed to completed', function () {
    $order = orderAt(OrderStatus::Confirmed);

    move($order, OrderStatus::Preparing);
    expect($order->fresh()->status)->toBe(OrderStatus::Preparing);

    move($order, OrderStatus::Ready);
    expect($order->fresh()->status)->toBe(OrderStatus::Ready);

    move($order, OrderStatus::Completed);
    expect($order->fresh()->status)->toBe(OrderStatus::Completed);
});

test('an order cannot skip a step or walk backwards', function () {
    $confirmed = orderAt(OrderStatus::Confirmed);
    $completed = orderAt(OrderStatus::Completed);

    expect(fn () => move($confirmed, OrderStatus::Completed))->toThrow(ValidationException::class);
    expect(fn () => move($completed, OrderStatus::Preparing))->toThrow(ValidationException::class);
    expect($confirmed->fresh()->status)->toBe(OrderStatus::Confirmed);
});

test('paying is the only thing that confirms an order', function () {
    $order = orderAt(OrderStatus::Pending, PaymentStatus::Unpaid);

    expect(fn () => move($order, OrderStatus::Confirmed))->toThrow(ValidationException::class);
    expect($order->fresh()->status)->toBe(OrderStatus::Pending);
});

test('an unpaid order may be cancelled and a paid one may not', function () {
    $unpaid = orderAt(OrderStatus::Pending, PaymentStatus::Unpaid);
    $paid = orderAt(OrderStatus::Pending);

    move($unpaid, OrderStatus::Cancelled, reason: 'Guest left');

    expect($unpaid->fresh()->status)->toBe(OrderStatus::Cancelled)
        ->and(fn () => move($paid, OrderStatus::Cancelled))->toThrow(ValidationException::class);
});

test('every move is written down with who made it', function () {
    $kitchen = User::factory()->kitchen()->create();
    $order = orderAt(OrderStatus::Confirmed);

    move($order, OrderStatus::Preparing, $kitchen);

    $entry = AuditLog::query()->where('action', 'order.preparing')->sole();

    expect($entry->causer_id)->toBe($kitchen->id)
        ->and($entry->context['from'])->toBe('confirmed');
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Ops/OrderTransitionTest.php`
Expected: FAIL — `Class "App\Services\OrderTransitioner" not found`.

- [ ] **Step 3: Add the machine to `app/Enums/OrderStatus.php`**

```php
    /**
     * Where an order may go from here. `confirmed` appears only as the step
     * paying takes it to: no staff move ever produces it.
     *
     * @return list<self>
     */
    public function allowedNext(): array
    {
        return match ($this) {
            self::Pending => [self::Confirmed, self::Cancelled],
            self::Confirmed => [self::Preparing],
            self::Preparing => [self::Ready],
            self::Ready => [self::Completed],
            self::Completed, self::Cancelled => [],
        };
    }
```

- [ ] **Step 4: Write `app/Services/OrderTransitioner.php`**

```php
<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Applies one step of the order's life. The policy says who may ask; this says
 * whether the order itself can go there, which is why an admin cannot shortcut
 * it either.
 */
class OrderTransitioner
{
    /**
     * @throws ValidationException
     */
    public function move(Order $order, OrderStatus $to, User $staff, ?string $reason = null): Order
    {
        if ($to === OrderStatus::Confirmed) {
            throw ValidationException::withMessages([
                'status' => 'An order is confirmed by being paid, not by hand.',
            ]);
        }

        if (! in_array($to, $order->status->allowedNext(), true)) {
            throw ValidationException::withMessages([
                'status' => "This order is {$order->status->label()} and cannot move to {$to->label()}.",
            ]);
        }

        if ($to === OrderStatus::Cancelled && $order->payment_status === PaymentStatus::Paid) {
            throw ValidationException::withMessages([
                'status' => 'A paid order cannot be cancelled here. Refund it with the provider first.',
            ]);
        }

        $from = $order->status;

        DB::transaction(function () use ($order, $to, $from, $staff, $reason): void {
            $order->status = $to;
            $order->save();

            $context = ['from' => $from->value];

            if ($reason !== null && trim($reason) !== '') {
                $context['reason'] = trim($reason);
            }

            AuditLog::record('order.'.$to->value, $order, $staff, $context);
        });

        return $order;
    }
}
```

- [ ] **Step 5: Extend `app/Policies/OrderPolicy.php`**

```php
    /**
     * Every staff role may watch the queue; the buttons are what differ.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Cashier, Role::Kitchen);
    }

    /**
     * Counter work: taking payment, handing the food over, cancelling.
     */
    public function manageOrders(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Cashier);
    }

    /**
     * Kitchen work: starting a dish and calling it ready.
     */
    public function cookOrders(User $user): bool
    {
        return $user->hasRole(Role::Admin, Role::Kitchen);
    }

    /**
     * Who may ask for this particular move. Whether the order can actually go
     * there is the transitioner's call.
     */
    public function transition(User $user, Order $order, OrderStatus $to): bool
    {
        return match ($to) {
            OrderStatus::Preparing, OrderStatus::Ready => $this->cookOrders($user),
            OrderStatus::Completed, OrderStatus::Cancelled => $this->manageOrders($user),
            default => false,
        };
    }
```

with `use App\Enums\OrderStatus;` and `use App\Models\Order;` added.

- [ ] **Step 6: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Ops/OrderTransitionTest.php`
Expected: PASS (5 tests).

Run: `vendor/bin/pint --dirty --format agent`

---

### Task 2: The status endpoint

**Files:**

- Create: `app/Http/Requests/Admin/UpdateOrderStatusRequest.php`
- Create: `app/Http/Controllers/Admin/OrderStatusController.php`
- Create: `app/Http/Resources/StaffOrderResource.php`
- Modify: `routes/api.php`
- Test: `tests/Feature/Ops/OrderStatusEndpointTest.php`

**Interfaces:**

- Consumes: `OrderTransitioner`, `OrderPolicy::transition`.
- Produces: `PATCH /api/v1/orders/{token}/status` with `{status, reason?}` returning `StaffOrderResource`, whose shape is: `token`, `order_number`, `daily_number`, `type`, `type_label`, `table_number`, `customer_name`, `status`, `status_label`, `payment_status`, `payment_method`, `payment_method_label`, `total`, `placed_at`, `paid_at`, `items[]`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Ops/OrderStatusEndpointTest.php`:

```php
<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;

function staffOrder(OrderStatus $status, PaymentStatus $payment = PaymentStatus::Paid): Order
{
    $order = Order::factory()->create(['subtotal' => 36000, 'total' => 36000]);
    $order->status = $status;
    $order->payment_status = $payment;
    $order->save();

    OrderItem::factory()->for($order)->create([
        'item_name' => 'Adobo',
        'size_name' => 'Large',
        'unit_price' => 36000,
        'quantity' => 1,
        'line_total' => 36000,
        'note' => 'Walang sibuyas',
    ]);

    return $order;
}

test('the kitchen starts and finishes cooking', function () {
    $order = staffOrder(OrderStatus::Confirmed);
    $kitchen = User::factory()->kitchen()->create();

    $this->actingAs($kitchen)
        ->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'preparing'])
        ->assertOk()
        ->assertJsonPath('data.status', 'preparing')
        ->assertJsonPath('data.items.0.note', 'Walang sibuyas');

    $this->actingAs($kitchen)
        ->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'ready'])
        ->assertOk()
        ->assertJsonPath('data.status', 'ready');
});

test('the kitchen cannot hand food over or cancel, and the counter cannot cook', function () {
    $ready = staffOrder(OrderStatus::Ready);
    $confirmed = staffOrder(OrderStatus::Confirmed);
    $unpaid = staffOrder(OrderStatus::Pending, PaymentStatus::Unpaid);

    $kitchen = User::factory()->kitchen()->create();
    $cashier = User::factory()->cashier()->create();

    $this->actingAs($kitchen)
        ->patchJson("/api/v1/orders/{$ready->token}/status", ['status' => 'completed'])
        ->assertForbidden();

    $this->actingAs($kitchen)
        ->patchJson("/api/v1/orders/{$unpaid->token}/status", ['status' => 'cancelled'])
        ->assertForbidden();

    $this->actingAs($cashier)
        ->patchJson("/api/v1/orders/{$confirmed->token}/status", ['status' => 'preparing'])
        ->assertForbidden();

    expect($ready->fresh()->status)->toBe(OrderStatus::Ready)
        ->and($confirmed->fresh()->status)->toBe(OrderStatus::Confirmed);
});

test('the counter hands the food over', function () {
    $order = staffOrder(OrderStatus::Ready);

    $this->actingAs(User::factory()->cashier()->create())
        ->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('data.status', 'completed');
});

test('the counter cancels an unpaid order with a reason, but never a paid one', function () {
    $cashier = User::factory()->cashier()->create();
    $unpaid = staffOrder(OrderStatus::Pending, PaymentStatus::Unpaid);
    $paid = staffOrder(OrderStatus::Pending);

    $this->actingAs($cashier)
        ->patchJson("/api/v1/orders/{$unpaid->token}/status", [
            'status' => 'cancelled',
            'reason' => 'Guest left',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    $this->actingAs($cashier)
        ->patchJson("/api/v1/orders/{$paid->token}/status", ['status' => 'cancelled'])
        ->assertStatus(422);
});

test('an order cannot skip a step and cannot be confirmed by hand', function () {
    $order = staffOrder(OrderStatus::Confirmed);
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'completed'])
        ->assertStatus(422);

    $this->actingAs($admin)
        ->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'confirmed'])
        ->assertJsonValidationErrors(['status']);

    expect($order->fresh()->status)->toBe(OrderStatus::Confirmed);
});

test('a guest cannot move anything', function () {
    $order = staffOrder(OrderStatus::Confirmed);

    $this->patchJson("/api/v1/orders/{$order->token}/status", ['status' => 'preparing'])
        ->assertUnauthorized();

    expect($order->fresh()->status)->toBe(OrderStatus::Confirmed);
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Ops/OrderStatusEndpointTest.php`
Expected: FAIL — 404, the route does not exist.

- [ ] **Step 3: Write `app/Http/Resources/StaffOrderResource.php`**

```php
<?php

namespace App\Http\Resources;

use App\Enums\PaymentState;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An order as the counter and the kitchen need to read it: the same order the
 * guest sees, plus when it was paid.
 *
 * @mixin Order
 */
class StaffOrderResource extends JsonResource
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
            'total' => $this->total,
            'placed_at' => $this->created_at?->toIso8601String(),
            'paid_at' => $this->whenLoaded('payments', fn (): ?string => $this->payments
                ->first(fn (Payment $payment): bool => $payment->state === PaymentState::Paid)
                ?->paid_at?->toIso8601String()),
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
```

- [ ] **Step 4: Write the request and the controller**

`app/Http/Requests/Admin/UpdateOrderStatusRequest.php`:

```php
<?php

namespace App\Http\Requests\Admin;

use App\Enums\OrderStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderStatusRequest extends FormRequest
{
    /**
     * The controller authorizes the particular move, since who may make it
     * depends on where the order is going.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => [
                'required',
                Rule::enum(OrderStatus::class)->only([
                    OrderStatus::Preparing,
                    OrderStatus::Ready,
                    OrderStatus::Completed,
                    OrderStatus::Cancelled,
                ]),
            ],
            'reason' => ['nullable', 'string', 'max:120'],
        ];
    }
}
```

`app/Http/Controllers/Admin/OrderStatusController.php`:

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateOrderStatusRequest;
use App\Http\Resources\StaffOrderResource;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderTransitioner;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;

class OrderStatusController extends Controller
{
    /**
     * Move an order one step along.
     */
    public function __invoke(
        UpdateOrderStatusRequest $request,
        Order $order,
        #[CurrentUser] User $user,
        OrderTransitioner $transitioner,
    ): StaffOrderResource {
        $to = OrderStatus::from($request->validated('status'));

        Gate::authorize('transition', [$order, $to]);

        $transitioner->move($order, $to, $user, $request->validated('reason'));

        return StaffOrderResource::make($order->refresh()->load(['items', 'payments']));
    }
}
```

- [ ] **Step 5: Add the route**

In `routes/api.php`, in the `password.changed` group beside `orders.mark-paid`:

```php
        Route::patch('/orders/{order}/status', OrderStatusController::class)->name('orders.status.update');
```

with `use App\Http\Controllers\Admin\OrderStatusController;`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Ops/OrderStatusEndpointTest.php`
Expected: PASS.

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`

---

### Task 3: The staff listing

**Files:**

- Create: `app/Http/Requests/Admin/ListStaffOrdersRequest.php`
- Create: `app/Http/Controllers/Admin/StaffOrderController.php`
- Modify: `app/Http/Controllers/CurrentUserController.php`, `routes/api.php`
- Test: `tests/Feature/Ops/StaffOrderListTest.php`

**Interfaces:**

- Produces: `GET /api/v1/staff/orders?view=queue|kitchen|done` returning `StaffOrderResource::collection`; abilities `manage_orders` and `cook_orders` on `GET /me`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Ops/StaffOrderListTest.php`:

```php
<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Date;

function listed(Order $order, OrderStatus $status, PaymentStatus $payment = PaymentStatus::Paid): Order
{
    $order->status = $status;
    $order->payment_status = $payment;
    $order->save();

    return $order;
}

test('the counter sees everything still open today, newest first', function () {
    $pending = listed(Order::factory()->create(['daily_number' => 1]), OrderStatus::Pending, PaymentStatus::Unpaid);
    $ready = listed(Order::factory()->create(['daily_number' => 2]), OrderStatus::Ready);
    listed(Order::factory()->create(['daily_number' => 3]), OrderStatus::Completed);

    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/staff/orders?view=queue')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.token', $ready->token)
        ->assertJsonPath('data.1.token', $pending->token);
});

test('the kitchen sees only paid orders, oldest first', function () {
    listed(Order::factory()->create(['daily_number' => 1]), OrderStatus::Pending, PaymentStatus::Unpaid);
    $confirmed = listed(Order::factory()->create(['daily_number' => 2]), OrderStatus::Confirmed);
    $ready = listed(Order::factory()->create(['daily_number' => 3]), OrderStatus::Ready);
    listed(Order::factory()->create(['daily_number' => 4]), OrderStatus::Completed);

    $this->actingAs(User::factory()->kitchen()->create())
        ->getJson('/api/v1/staff/orders?view=kitchen')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.token', $confirmed->token)
        ->assertJsonPath('data.1.token', $ready->token);
});

test('the done view holds what is finished and cancelled', function () {
    listed(Order::factory()->create(['daily_number' => 1]), OrderStatus::Completed);
    listed(Order::factory()->create(['daily_number' => 2]), OrderStatus::Cancelled, PaymentStatus::Unpaid);
    listed(Order::factory()->create(['daily_number' => 3]), OrderStatus::Ready);

    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/staff/orders?view=done')
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

test('yesterday stays in yesterday', function () {
    $old = Order::factory()->create(['daily_number' => 1, 'business_date' => Date::now('Asia/Manila')->subDay()->toDateString()]);
    listed($old, OrderStatus::Ready);

    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/staff/orders?view=queue')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

test('guests cannot read the queue', function () {
    $this->getJson('/api/v1/staff/orders?view=queue')->assertUnauthorized();
});

test('staff are told which buttons they may press', function () {
    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.manage_orders', true)
        ->assertJsonPath('abilities.cook_orders', false);

    $this->actingAs(User::factory()->kitchen()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.manage_orders', false)
        ->assertJsonPath('abilities.cook_orders', true);
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Ops/StaffOrderListTest.php`
Expected: FAIL — 404 on `/api/v1/staff/orders`.

- [ ] **Step 3: Write the request**

`app/Http/Requests/Admin/ListStaffOrdersRequest.php`:

```php
<?php

namespace App\Http\Requests\Admin;

use App\Models\Order;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListStaffOrdersRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Order::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'view' => ['sometimes', Rule::in(['queue', 'kitchen', 'done'])],
        ];
    }
}
```

- [ ] **Step 4: Write the controller**

`app/Http/Controllers/Admin/StaffOrderController.php`:

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListStaffOrdersRequest;
use App\Http\Resources\StaffOrderResource;
use App\Models\Order;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Date;

class StaffOrderController extends Controller
{
    /**
     * Today's orders for whichever screen is asking. Yesterday belongs to the
     * reports, not to the queue.
     */
    public function __invoke(ListStaffOrdersRequest $request): AnonymousResourceCollection
    {
        $view = $request->string('view', 'queue')->toString();

        $query = Order::query()
            ->with(['items', 'payments'])
            ->where('business_date', Date::now((string) config('restaurant.timezone'))->toDateString());

        $orders = match ($view) {
            'kitchen' => $query
                ->whereIn('status', [OrderStatus::Confirmed, OrderStatus::Preparing, OrderStatus::Ready])
                ->where('payment_status', PaymentStatus::Paid)
                ->orderBy('id')
                ->get(),
            'done' => $query
                ->whereIn('status', [OrderStatus::Completed, OrderStatus::Cancelled])
                ->orderByDesc('id')
                ->take(100)
                ->get(),
            default => $query
                ->whereIn('status', [
                    OrderStatus::Pending,
                    OrderStatus::Confirmed,
                    OrderStatus::Preparing,
                    OrderStatus::Ready,
                ])
                ->orderByDesc('id')
                ->get(),
        };

        return StaffOrderResource::collection($orders);
    }
}
```

- [ ] **Step 5: Add the abilities and the route**

In `app/Http/Controllers/CurrentUserController.php`:

```php
                'manage_orders' => $user->can('manageOrders', Order::class),
                'cook_orders' => $user->can('cookOrders', Order::class),
```

In `routes/api.php`, in the `password.changed` group:

```php
        Route::get('/staff/orders', StaffOrderController::class)->name('staff.orders.index');
```

with `use App\Http\Controllers\Admin\StaffOrderController;`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `php artisan test --compact tests/Feature/Ops`
Expected: PASS.

Run: `php artisan test --compact`
Expected: every earlier test still passes.

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`

---

### Task 4: The ops library in the browser

**Files:**

- Create: `resources/js/lib/ops.ts`, `resources/js/lib/ops-polling.ts`, `resources/js/lib/chime.ts`
- Modify: `resources/js/types/order.ts`
- Test: `resources/js/lib/ops.test.ts`

**Interfaces:**

- Produces: `StaffOrder` and `OpsView` types; `listStaffOrders(view)`, `updateOrderStatus(token, status, reason?)`, `queueLoader`, `kitchenLoader`, `doneLoader`; `elapsedLabel(iso, now?)` → `"just now" | "4m" | "1h 5m"`; `newTokens(previous, next)`; `useStaffOrders(view, initial, intervalMs)`; `playChime()`, `chimeMuted()`, `setChimeMuted(muted)`.

- [ ] **Step 1: Write the failing test**

`resources/js/lib/ops.test.ts`:

```ts
import { describe, expect, it } from 'vite-plus/test';
import { elapsedLabel, newTokens } from '@/lib/ops';

const now = Date.parse('2026-09-23T12:00:00+08:00');

describe('elapsedLabel', () => {
    it('reads the wait the way a cashier says it', () => {
        expect(elapsedLabel('2026-09-23T11:59:30+08:00', now)).toBe('just now');
        expect(elapsedLabel('2026-09-23T11:56:00+08:00', now)).toBe('4m');
        expect(elapsedLabel('2026-09-23T10:55:00+08:00', now)).toBe('1h 5m');
    });

    it('never reads the future as a wait', () => {
        expect(elapsedLabel('2026-09-23T12:05:00+08:00', now)).toBe('just now');
    });

    it('says nothing useful about nothing', () => {
        expect(elapsedLabel(null, now)).toBe('');
    });
});

describe('newTokens', () => {
    it('finds what arrived since the last look', () => {
        expect(newTokens(['a', 'b'], ['c', 'a', 'b'])).toEqual(['c']);
    });

    it('is quiet when nothing is new', () => {
        expect(newTokens(['a', 'b'], ['b', 'a'])).toEqual([]);
        expect(newTokens(['a'], [])).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/ops`.

- [ ] **Step 3: Add the types to `resources/js/types/order.ts`**

```ts
export type OpsView = 'queue' | 'kitchen' | 'done';

export type StaffOrder = Omit<Order, 'subtotal' | 'items'> & {
    paid_at: string | null;
    items: OrderItem[];
};
```

- [ ] **Step 4: Write `resources/js/lib/ops.ts`**

```ts
import { http } from '@/lib/http';
import type { OpsView, OrderStatus, StaffOrder } from '@/types';

type Wrapped<T> = { data: T };

export async function listStaffOrders(view: OpsView): Promise<StaffOrder[]> {
    const response = await http.get<Wrapped<StaffOrder[]>>(
        `/api/v1/staff/orders?view=${view}`,
    );

    return response.data;
}

export async function updateOrderStatus(
    token: string,
    status: OrderStatus,
    reason?: string,
): Promise<StaffOrder> {
    const response = await http.patch<Wrapped<StaffOrder>>(
        `/api/v1/orders/${token}/status`,
        reason === undefined ? { status } : { status, reason },
    );

    return response.data;
}

export const queueLoader = () => listStaffOrders('queue');
export const kitchenLoader = () => listStaffOrders('kitchen');
export const doneLoader = () => listStaffOrders('done');

/** How long an order has been waiting, said the way the counter says it. */
export function elapsedLabel(iso: string | null, now = Date.now()): string {
    if (iso === null) {
        return '';
    }

    const minutes = Math.floor((now - Date.parse(iso)) / 60_000);

    if (!Number.isFinite(minutes) || minutes < 1) {
        return 'just now';
    }

    if (minutes < 60) {
        return `${minutes}m`;
    }

    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Which orders appeared since the last look — what the chime is for. */
export function newTokens(previous: string[], next: string[]): string[] {
    const seen = new Set(previous);

    return next.filter((token) => !seen.has(token));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Write the polling hook and the chime**

`resources/js/lib/ops-polling.ts`:

```ts
import { useEffect, useState } from 'react';
import { listStaffOrders } from '@/lib/ops';
import type { OpsView, StaffOrder } from '@/types';

/**
 * Keep a staff screen fresh while somebody is looking at it. A hidden tab in
 * the back office stops asking.
 */
export function useStaffOrders(
    view: OpsView,
    initial: StaffOrder[],
    intervalMs: number,
): [StaffOrder[], (orders: StaffOrder[]) => void] {
    const [orders, setOrders] = useState(initial);

    useEffect(() => {
        setOrders(initial);
    }, [initial]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (document.hidden) {
                return;
            }

            listStaffOrders(view)
                .then(setOrders)
                .catch(() => undefined);
        }, intervalMs);

        return () => window.clearInterval(timer);
    }, [view, intervalMs]);

    return [orders, setOrders];
}
```

`resources/js/lib/chime.ts`:

```ts
const MUTE_KEY = 'bb.kitchen-muted';

/** A short two-note beep, made in the browser: no file, no network, no CSP. */
export function playChime(): void {
    if (chimeMuted()) {
        return;
    }

    try {
        const context = new AudioContext();
        const gain = context.createGain();

        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            context.currentTime + 0.45,
        );
        gain.connect(context.destination);

        [880, 1320].forEach((frequency, index) => {
            const tone = context.createOscillator();

            tone.type = 'sine';
            tone.frequency.value = frequency;
            tone.connect(gain);
            tone.start(context.currentTime + index * 0.18);
            tone.stop(context.currentTime + index * 0.18 + 0.16);
        });

        window.setTimeout(() => void context.close(), 900);
    } catch {
        // A kitchen without sound still has its eyes.
    }
}

export function chimeMuted(): boolean {
    try {
        return globalThis.localStorage?.getItem(MUTE_KEY) === '1';
    } catch {
        return false;
    }
}

export function setChimeMuted(muted: boolean): void {
    try {
        globalThis.localStorage?.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
        // The switch simply will not be remembered.
    }
}
```

- [ ] **Step 7: Verify**

Run: `npm run check:fix`
Run: `npm run types:check`
Expected: clean.

---

### Task 5: The cashier queue

**Files:**

- Create: `resources/js/components/ops/order-card.tsx`
- Create: `resources/js/pages/admin/orders.tsx`
- Modify: `resources/js/router.tsx`, `resources/js/layouts/admin-layout.tsx`

**Interfaces:**

- Consumes: `useStaffOrders`, `updateOrderStatus`, `elapsedLabel`, `markOrderPaid` (Module 5's `POST /orders/{token}/mark-paid` — add `markOrderPaid(token)` to `resources/js/lib/ops.ts`).
- Produces: `<OrderCard order actions />` and the `/admin/orders` route.

- [ ] **Step 1: Add `markOrderPaid` to `resources/js/lib/ops.ts`**

```ts
export async function markOrderPaid(token: string): Promise<StaffOrder> {
    const response = await http.post<Wrapped<StaffOrder>>(
        `/api/v1/orders/${token}/mark-paid`,
    );

    return response.data;
}
```

- [ ] **Step 2: Write `resources/js/components/ops/order-card.tsx`**

One card, used by both screens: the big daily number, where it goes (table or name), the lines with their notes, the total, how long it has waited, and a slot for buttons.

```tsx
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { elapsedLabel } from '@/lib/ops';
import { formatPeso } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { StaffOrder } from '@/types';

type OrderCardProps = {
    order: StaffOrder;
    now: number;
    children?: ReactNode;
};

export function OrderCard({ order, now, children }: OrderCardProps) {
    const waiting = elapsedLabel(order.placed_at, now);

    return (
        <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <header className="flex items-start justify-between gap-3">
                <div className="flex items-baseline gap-3">
                    <p className="font-display text-3xl leading-none font-extrabold">
                        {String(order.daily_number).padStart(4, '0')}
                    </p>
                    <p className="font-medium">
                        {order.table_number !== null
                            ? `Table ${order.table_number}`
                            : (order.customer_name ?? order.type_label)}
                    </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <Badge
                        variant={
                            order.payment_status === 'paid'
                                ? 'default'
                                : 'outline'
                        }
                        className={cn(
                            order.payment_status === 'paid' &&
                                'bg-kalamansi text-uling',
                        )}
                    >
                        {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </Badge>
                    <p className="text-sm text-muted-foreground">{waiting}</p>
                </div>
            </header>

            <ul className="flex flex-col gap-1">
                {order.items.map((item) => (
                    <li key={item.id} className="flex gap-2">
                        <span className="font-display font-extrabold">
                            {item.quantity}×
                        </span>
                        <span className="flex min-w-0 flex-col">
                            <span>
                                {item.item_name}
                                <span className="text-muted-foreground">{` · ${item.size_name}`}</span>
                            </span>
                            {item.note && (
                                <span className="font-semibold text-achuete">
                                    {item.note}
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p className="font-display text-lg font-extrabold">
                    {formatPeso(order.total)}
                </p>
                <div className="flex flex-wrap gap-2">{children}</div>
            </footer>
        </article>
    );
}
```

- [ ] **Step 3: Write `resources/js/pages/admin/orders.tsx`**

The queue: a tab switch between what is open and what is done today, a card per order, and the counter's three buttons. Each button call updates that one card in place and shows any 422 message next to it.

Behaviour to implement:

- `const [view, setView] = useState<OpsView>('queue')` with `useStaffOrders(view, initial, 7000)`; `initial` comes from `useLoaderData<typeof queueLoader>()` and the hook refetches when `view` changes.
- `now` ticks every 30s in state so the waiting times move without a refetch.
- Buttons, by ability (`abilities.manage_orders` from `useRouteLoaderData<typeof staffLoader>('admin')`):
    - unpaid → **Mark as Paid** (`markOrderPaid`)
    - `ready` → **Handed over** (`updateOrderStatus(token, 'completed')`)
    - unpaid and `pending` → **Cancel** (asks for an optional reason through `ConfirmDialog`, then `updateOrderStatus(token, 'cancelled', reason)`)
- After any action, replace that order in the list with the returned one; on `HttpError`, show `failure.body.message` on the card.
- Empty state: "Nothing waiting. The counter is clear."

- [ ] **Step 4: Add the route and the nav link**

`resources/js/router.tsx`, in the admin children:

```tsx
            {
                path: 'orders',
                loader: queueLoader,
                lazy: page(() => import('@/pages/admin/orders')),
                errorElement: <RouteError />,
            },
```

`resources/js/layouts/admin-layout.tsx`: add **Orders** (`/admin/orders`) to the links, before Menu.

- [ ] **Step 5: Verify**

Run: `npm run check:fix`
Run: `npm run types:check`
Run: `npm test`
Expected: clean.

---

### Task 6: The kitchen display

**Files:**

- Create: `resources/js/pages/admin/kitchen.tsx`
- Modify: `resources/js/router.tsx`, `resources/js/layouts/admin-layout.tsx`

**Interfaces:**

- Consumes: `useStaffOrders('kitchen', …, 5000)`, `updateOrderStatus`, `newTokens`, `playChime`, `chimeMuted`, `setChimeMuted`, `<OrderCard>`.

- [ ] **Step 1: Write `resources/js/pages/admin/kitchen.tsx`**

Behaviour to implement:

- Three columns from one list: `confirmed` → **New**, `preparing` → **Cooking**, `ready` → **Ready**. `grid gap-4 md:grid-cols-3`, so a phone stacks them.
- Each card carries one button, by ability (`abilities.cook_orders`): New → **Start cooking** (`preparing`), Cooking → **Ready** (`ready`). A ready card shows "Waiting for the counter".
- The chime: keep the previous token list in a ref; on every refresh, `newTokens(previous, next)` over the **New** column only, and if it is non-empty and this is not the first render, `playChime()`.
- A **Sound on / Sound off** toggle in the header, backed by `chimeMuted()` / `setChimeMuted()`. Pressing it is also the gesture browsers require before audio may play, so the first press unlocks it.
- The waiting time on each card turns achuete past 10 minutes, so a forgotten order stands out.
- Empty state per column: "—".

- [ ] **Step 2: Add the route and the nav link**

```tsx
            {
                path: 'kitchen',
                loader: kitchenLoader,
                lazy: page(() => import('@/pages/admin/kitchen')),
                errorElement: <RouteError />,
            },
```

and a **Kitchen** link in `admin-layout.tsx`.

- [ ] **Step 3: Verify**

Run: `npm run check:fix`
Run: `npm run types:check`
Run: `npm test`
Run: `npm run build`
Expected: clean, and the admin chunks stay out of the customer bundle.

---

### Task 7: Module gate

- [ ] **Step 1: Run every automated check**

Run: `php artisan test --compact`
Run: `composer types:check`
Run: `composer lint:check`
Run: `npm test`
Run: `npm run types:check`
Run: `npm run check`
Run: `npm run build`

- [ ] **Step 2: Confirm the routes and the invariants**

Run: `php artisan route:list --path=api/v1 --except-vendor`
Expected: `GET api/v1/staff/orders` and `PATCH api/v1/orders/{order}/status`, both behind `auth:sanctum`, `active` and `password.changed`.

Run: `grep -rn "status = OrderStatus" app --include=*.php`
Expected: only `OrderTransitioner` and `PaymentConfirmer` — nothing else moves an order.

- [ ] **Step 3: User walkthrough**

With `composer run dev` running, and two browser windows side by side (staff in one, the guest's `/order/{token}` in the other):

1. Place an order as a guest, then in the staff window open `/admin/orders` as a cashier: the order appears within seven seconds, marked **Unpaid**.
2. **Mark as Paid** → the guest's screen turns to Paid, and the order appears in `/admin/kitchen` under **New** (with the chime, unless muted).
3. As kitchen: **Start cooking** → **Ready**. The guest's steps move along each time.
4. As cashier: **Handed over** → the order leaves the queue and appears under the **Done today** tab.
5. Place another order, leave it unpaid, and **Cancel** it with a reason. Confirm a paid order offers no Cancel.
6. Check the kitchen display at 320px, 768px and 1280px: three columns become one stack, and nothing scrolls sideways.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: cashier queue and kitchen display with the order state machine"
```
