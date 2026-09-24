# Module 9b — Counter Kiosk

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the shop's one tablet into a self-order kiosk: an idle screen that says _Touch to order_, a flow that takes a name instead of a table, and a screen that always hands itself back clean to the next customer in the queue.

**Architecture:** Kiosk mode is a flag stored on that device alone, so nothing changes for a customer's own phone. The ordering screens already exist; the kiosk adds an idle screen in front of them, a watcher that resets an abandoned order, and a "Done" that returns to idle. One server rule loosens: a dine-in order needs a table number **or** a name.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5, React 19, React Router 8, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-public-website-and-kiosk-design.md` §4

## Global Constraints

- **The kiosk is a shared device.** When it returns to idle it clears the cart and forgets the last order, so nobody inherits the previous customer's screen. (spec §6)
- Kiosk mode lives in that device's own storage. **A customer's phone never sees the idle screen.** (spec §4)
- **A dine-in order needs a table number or a name, not both.** The QR-to-table flow from Module 4 keeps working unchanged. (spec §4)
- Money, tokens, policies and the payment flow are untouched.
- Kiosk copy is short and the targets are large: this is read at arm's length by someone standing up.
- After every PHP edit run `vendor/bin/pint --dirty --format agent`.
- Commands the **user** runs: `git commit`.

## File Structure

| File                                           | Responsibility                                        |
| ---------------------------------------------- | ----------------------------------------------------- |
| `app/Http/Requests/PlaceOrderRequest.php`      | _Modify:_ dine-in accepts a table **or** a name       |
| `tests/Feature/Orders/PlaceOrderTest.php`      | _Modify:_ the new rule, both ways                     |
| `resources/js/lib/kiosk.ts`                    | `isKiosk`, `setKiosk`, `IDLE_MS`, `DONE_MS`, `isIdle` |
| `resources/js/lib/kiosk.test.ts`               | The flag and the idle maths                           |
| `resources/js/pages/kiosk.tsx`                 | The idle screen                                       |
| `resources/js/components/kiosk/idle-watch.tsx` | Sends an abandoned order back to idle                 |
| `resources/js/layouts/order-layout.tsx`        | _Modify:_ in kiosk mode, nothing leads away           |
| `resources/js/pages/order/checkout.tsx`        | _Modify:_ a name at the kiosk, not a table            |
| `resources/js/pages/order/status.tsx`          | _Modify:_ Done, and a return to idle                  |
| `resources/js/router.tsx`                      | _Modify:_ `/kiosk`                                    |

---

### Task 1: A dine-in order may carry a name instead of a table

**Files:**

- Modify: `app/Http/Requests/PlaceOrderRequest.php`
- Test: `tests/Feature/Orders/PlaceOrderTest.php`

**Interfaces:**

- Produces: `POST /api/v1/orders` accepts `type: dine_in` with either `table_number` or `customer_name`; with neither it fails on both fields.

- [ ] **Step 1: Write the failing tests**

Add to `tests/Feature/Orders/PlaceOrderTest.php`:

```php
test('a dine-in order at the counter carries a name instead of a table', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'table_number' => null,
        'customer_name' => 'Ana',
    ]))
        ->assertCreated()
        ->assertJsonPath('data.type', 'dine_in')
        ->assertJsonPath('data.table_number', null)
        ->assertJsonPath('data.customer_name', 'Ana');
});

test('a dine-in order with neither a table nor a name is refused', function () {
    $size = MenuItemSize::factory()->create(['price' => 10000]);

    $this->postJson('/api/v1/orders', orderPayload($size, [
        'table_number' => null,
        'customer_name' => null,
    ]))->assertJsonValidationErrors(['table_number', 'customer_name']);
});
```

The existing test _dine-in needs a table the restaurant actually has_ keeps its second half (table 99 is refused) but its first half moves into the test above, because a missing table is no longer an error on its own.

- [ ] **Step 2: Run them to watch them fail**

Run: `php artisan test --compact tests/Feature/Orders/PlaceOrderTest.php`
Expected: FAIL — a dine-in order without a table is currently refused.

- [ ] **Step 3: Loosen the rule**

In `PlaceOrderRequest`, keep the take-out rule as it is and replace the dine-in requirement with a pair that points at each other:

```php
            'table_number' => [
                Rule::requiredIf(fn (): bool => $this->isDineIn() && ! $this->hasName()),
                'nullable',
                'integer',
                'min:1',
                'max:'.(int) config('restaurant.tables'),
            ],
            'customer_name' => [
                Rule::requiredIf(fn (): bool => $this->isTakeout() || ($this->isDineIn() && ! $this->hasTable())),
                'nullable',
                'string',
                'max:40',
            ],
```

with three small helpers, and `prepareForValidation` no longer wiping the name on a dine-in order:

```php
    private function isDineIn(): bool
    {
        return $this->input('type') === OrderType::DineIn->value;
    }

    private function isTakeout(): bool
    {
        return $this->input('type') === OrderType::Takeout->value;
    }

    private function hasTable(): bool
    {
        return $this->filled('table_number');
    }

    private function hasName(): bool
    {
        return trim((string) $this->input('customer_name')) !== '';
    }
```

```php
    protected function prepareForValidation(): void
    {
        $name = trim((string) $this->input('customer_name', ''));

        $this->merge([
            'table_number' => $this->isTakeout() ? null : $this->input('table_number'),
            'customer_name' => $name === '' ? null : $name,
        ]);
    }
```

Messages gain a line each so the guest is told what is missing:

```php
            'table_number.required' => 'Tell us the table, or leave a name.',
            'customer_name.required' => 'Leave a name so we can call you.',
```

- [ ] **Step 4: Run the suite**

Run: `php artisan test --compact tests/Feature/Orders`
Expected: PASS.

Run: `vendor/bin/pint --dirty --format agent`, `composer types:check`

---

### Task 2: Kiosk mode and the idle screen

**Files:**

- Create: `resources/js/lib/kiosk.ts`, `resources/js/lib/kiosk.test.ts`, `resources/js/pages/kiosk.tsx`
- Modify: `resources/js/router.tsx`

**Interfaces:**

- Produces: `isKiosk()`, `setKiosk(on)`, `IDLE_MS = 90_000`, `DONE_MS = 20_000`, `isIdle(lastTouch, now)`; the `/kiosk` route showing the idle screen.

- [ ] **Step 1: Write the failing test**

`resources/js/lib/kiosk.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { IDLE_MS, isIdle, isKiosk, setKiosk } from '@/lib/kiosk';

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

describe('kiosk mode', () => {
    it('is off until the shop turns it on, and can be turned off again', () => {
        expect(isKiosk()).toBe(false);

        setKiosk(true);
        expect(isKiosk()).toBe(true);

        setKiosk(false);
        expect(isKiosk()).toBe(false);
    });
});

describe('isIdle', () => {
    it('waits out the whole window before calling an order abandoned', () => {
        expect(isIdle(1_000, 1_000 + IDLE_MS - 1)).toBe(false);
        expect(isIdle(1_000, 1_000 + IDLE_MS)).toBe(true);
    });
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npm test` — cannot resolve `@/lib/kiosk`.

- [ ] **Step 3: Write `resources/js/lib/kiosk.ts`**

```ts
const KIOSK_KEY = 'bb.kiosk';

/** How long an untouched order waits before the screen clears itself. */
export const IDLE_MS = 90_000;

/** How long the order number stays up before the kiosk greets the next guest. */
export const DONE_MS = 20_000;

export function isKiosk(): boolean {
    try {
        return globalThis.localStorage?.getItem(KIOSK_KEY) === '1';
    } catch {
        return false;
    }
}

export function setKiosk(on: boolean): void {
    try {
        if (on) {
            globalThis.localStorage?.setItem(KIOSK_KEY, '1');
        } else {
            globalThis.localStorage?.removeItem(KIOSK_KEY);
        }
    } catch {
        // A tablet that cannot remember simply behaves like a phone.
    }
}

export function isIdle(lastTouch: number, now: number): boolean {
    return now - lastTouch >= IDLE_MS;
}
```

- [ ] **Step 4: Write `resources/js/pages/kiosk.tsx`**

The idle screen, full height, dark: the shop's name, today's dishes rotating large behind a **Touch to order** call, and the whole screen a button.

- Reads the menu from the `order` branch loader, rotating `featuredItems` every four seconds unless the device asks for less motion.
- The whole panel is one `<button>` that navigates to `/order`; the visible label is "Touch to order".
- `?setup=1` turns kiosk mode on for this device and then cleans the address; **press and hold the shop's name for three seconds** turns it off, so a curious customer cannot leave the kiosk by tapping.
- Entering the screen clears the cart and forgets the last order, so it always starts empty.

- [ ] **Step 5: Add the route**

```tsx
    {
        path: '/kiosk',
        element: <Kiosk />,
        loader: publicMenuLoader,
        errorElement: <RouteError />,
    },
```

- [ ] **Step 6: Verify**

Run: `npm test`, `npm run types:check`, `npm run check:fix`

---

### Task 3: The kiosk inside the ordering flow

**Files:**

- Create: `resources/js/components/kiosk/idle-watch.tsx`
- Modify: `resources/js/layouts/order-layout.tsx`, `resources/js/pages/order/checkout.tsx`, `resources/js/pages/order/status.tsx`

**Interfaces:**

- Consumes: `isKiosk`, `IDLE_MS`, `DONE_MS`, `useCart`.
- Produces: `<IdleWatch />` — while in kiosk mode, any pointer or key press resets a timer; when it runs out the cart is cleared and the screen returns to `/kiosk`.

- [ ] **Step 1: Write `<IdleWatch />`**

Listens for `pointerdown` and `keydown` on the window, keeps the last touch in a ref, and checks every five seconds. On an idle timeout it calls `clear()` on the cart and navigates to `/kiosk`. It renders nothing, and does nothing at all when the device is not a kiosk.

- [ ] **Step 2: Hide the ways out (`order-layout.tsx`)**

In kiosk mode the header's name is plain text rather than a link home, the footer's "Back to the website" disappears, and `<IdleWatch />` is mounted.

- [ ] **Step 3: A name, not a table (`order/checkout.tsx`)**

In kiosk mode the "Where are you eating?" choice stays, but both answers ask for a **name** ("Pangalan para itawag") and the table field is not shown — the customer is standing at the counter. The payload sends `table_number: null` and the name for either type.

- [ ] **Step 4: Done, and back to idle (`order/status.tsx`)**

In kiosk mode the page shows a large **Done** button that clears the cart, forgets the order and returns to `/kiosk`; it also returns by itself after `DONE_MS`. The "Back to the menu" link is hidden, and so is the "Your order" shortcut, because the next customer must not see it.

- [ ] **Step 5: Verify**

Run: `npm run check:fix`, `npm run types:check`, `npm test`, `npm run build`

---

### Task 4: Module gate

- [ ] **Step 1: Every check**

Run: `php artisan test --compact`, `composer types:check`, `composer lint:check`, `npm test`, `npm run types:check`, `npm run check`, `npm run build`

- [ ] **Step 2: The walkthrough, on the tablet or in a second browser**

1. Open `/kiosk?setup=1` — the address tidies itself and the idle screen appears with dishes rotating.
2. Touch the screen → `/order`. Add two dishes, open the cart, Checkout.
3. Choose **Dine in**, leave a name, place the order: the number appears with **Done**.
4. Press **Done** → back to idle, and the cart is empty.
5. Start another order, then leave the tablet alone: after ninety seconds it returns to idle by itself, with nothing kept.
6. On a normal browser (not set up), `/order` behaves exactly as before — no idle screen, and the table field is back.
7. Press and hold the shop's name on the idle screen for three seconds to leave kiosk mode.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: counter kiosk with an idle screen and a self-clearing till"
```
