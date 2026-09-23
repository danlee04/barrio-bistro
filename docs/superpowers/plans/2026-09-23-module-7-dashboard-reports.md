# Module 7 — Dashboard & Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the empty admin dashboard into the owner's morning read: what sold today, how many orders, the average ticket, the week's shape, and which dishes carry the kitchen.

**Architecture:** One read-only service (`SalesReport`) answers one endpoint with everything the dashboard needs, counted from `orders.business_date` so a day means a Manila day. The screen is four stat tiles, one bar chart (Recharts) and a top-dish list, refreshed every minute while the tab is visible.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5, PHPStan level 7, Pint, React 19, Recharts 3.10, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md` (§3 Modules, §6 Security Layers)

## Global Constraints

- **Sales count paid orders only.** An unpaid or cancelled order never adds to a peso figure. (spec §5: the two tracks are independent)
- **A day is `orders.business_date`** — already a Manila `Y-m-d` string from Module 4 — so no timezone arithmetic at read time and last night stays in last night.
- **Reports are Admin-only.** The endpoint lives in the existing `role:admin` group; cashier and kitchen get 403. (spec §6 — `Gate::define('view-reports')` in spirit, enforced by the route group and the `view_reports` ability)
- Money stays integer centavos end to end; the average is integer division, never a float.
- Raw SQL is used only for aggregates, with **no request input in the string** — dates and statuses are bound. (spec §6, CLAUDE.md → SQL injection)
- Chart colour is **`#7d9130`** (a deeper kalamansi). It was not chosen by eye: `dataviz/scripts/validate_palette.js` FAILs `--dahon` (too dark, reads gray) and WARNs the brand `--kalamansi` (2.27:1 contrast); `#7d9130` passes the lightness band, the chroma floor and contrast ≥ 3:1 on a white card.
- One series means **no legend** — the card title names it — plus a table view for anyone who cannot read the bars.
- **CSP:** Recharts writes inline `style=""` attributes, which production CSP refuses today. Decision (2026-09-23): add **`style-src-attr 'unsafe-inline'`** and nothing else — `<style>` blocks and stylesheets still need `'self'` or the nonce, and `script-src` keeps nonce + `strict-dynamic`.
- After every PHP edit run `vendor/bin/pint --dirty --format agent`. No migration in this module. Recharts is already installed (3.10.1).

## File Structure

| File                                               | Responsibility                                 |
| -------------------------------------------------- | ---------------------------------------------- |
| `app/Services/SalesReport.php`                     | Every number on the dashboard, in one read     |
| `app/Http/Controllers/Admin/ReportsController.php` | `GET /admin/reports/summary`                   |
| `app/Http/Controllers/CurrentUserController.php`   | _Modify:_ `view_reports` ability               |
| `app/Http/Middleware/SecurityHeaders.php`          | _Modify:_ `style-src-attr`                     |
| `routes/api.php`                                   | _Modify:_ the reports route                    |
| `resources/js/types/report.ts`                     | `DaySales`, `TopItem`, `ReportSummary`         |
| `resources/js/lib/reports.ts`                      | `fetchReportSummary`, `reportsLoader`          |
| `resources/js/components/reports/stat-tile.tsx`    | One headline number                            |
| `resources/js/components/reports/sales-chart.tsx`  | The week's bars, plus the same data as a table |
| `resources/js/pages/admin/dashboard.tsx`           | _Rewrite:_ tiles, chart, top dishes            |
| `resources/css/app.css`                            | _Modify:_ `--chart-sales` token                |
| `tests/Feature/Reports/SalesReportTest.php`        | The numbers and who may read them              |
| `tests/Feature/SecurityHeadersTest.php`            | _Modify:_ the new directive                    |

---

### Task 1: The sales report

**Files:**

- Create: `app/Services/SalesReport.php`, `app/Http/Controllers/Admin/ReportsController.php`
- Modify: `routes/api.php`, `app/Http/Controllers/CurrentUserController.php`
- Test: `tests/Feature/Reports/SalesReportTest.php`

**Interfaces:**

- Produces: `SalesReport::summary(int $span = 7): array` shaped as
  `{today: {date, sales, orders, paid_orders, cancelled_orders, average_order}, days: [{date, label, sales, orders}], top_items: [{name, quantity, sales}]}`;
  `GET /api/v1/admin/reports/summary` returning it under `data`; the `view_reports` ability on `GET /me`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Reports/SalesReportTest.php`:

```php
<?php

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Support\Facades\Date;

function soldOrder(
    int $total,
    ?string $date = null,
    PaymentStatus $payment = PaymentStatus::Paid,
    OrderStatus $status = OrderStatus::Completed,
): Order {
    $order = Order::factory()->create([
        'business_date' => $date ?? Date::now('Asia/Manila')->toDateString(),
        'subtotal' => $total,
        'total' => $total,
    ]);

    $order->status = $status;
    $order->payment_status = $payment;
    $order->save();

    return $order;
}

function soldLine(Order $order, string $name, string $sizeName, int $unitPrice, int $quantity): void
{
    OrderItem::factory()->for($order)->create([
        'item_name' => $name,
        'size_name' => $sizeName,
        'unit_price' => $unitPrice,
        'quantity' => $quantity,
        'line_total' => $unitPrice * $quantity,
    ]);
}

test('today counts paid orders only', function () {
    soldOrder(36000);
    soldOrder(20000);
    soldOrder(99900, payment: PaymentStatus::Unpaid, status: OrderStatus::Pending);
    soldOrder(50000, payment: PaymentStatus::Unpaid, status: OrderStatus::Cancelled);

    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertOk()
        ->assertJsonPath('data.today.sales', 56000)
        ->assertJsonPath('data.today.paid_orders', 2)
        ->assertJsonPath('data.today.orders', 4)
        ->assertJsonPath('data.today.cancelled_orders', 1)
        ->assertJsonPath('data.today.average_order', 28000);
});

test('an empty day reports zeroes rather than nothing', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertOk()
        ->assertJsonPath('data.today.sales', 0)
        ->assertJsonPath('data.today.average_order', 0)
        ->assertJsonCount(7, 'data.days')
        ->assertJsonCount(0, 'data.top_items');
});

test('the week holds seven days, oldest first, with the quiet ones at zero', function () {
    $today = Date::now('Asia/Manila');

    soldOrder(10000, $today->toDateString());
    soldOrder(25000, $today->subDays(2)->toDateString());
    soldOrder(90000, $today->subDays(9)->toDateString());

    $response = $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertOk();

    $days = $response->json('data.days');

    expect($days)->toHaveCount(7)
        ->and($days[0]['date'])->toBe($today->subDays(6)->toDateString())
        ->and($days[6]['date'])->toBe($today->toDateString())
        ->and($days[6]['sales'])->toBe(10000)
        ->and($days[4]['sales'])->toBe(25000)
        ->and($days[1]['sales'])->toBe(0)
        ->and(array_sum(array_column($days, 'sales')))->toBe(35000);
});

test('top dishes add their sizes together and lead with the busiest', function () {
    $first = soldOrder(50000);
    soldLine($first, 'Adobo', 'Regular', 18000, 2);
    soldLine($first, 'Adobo', 'Large', 24000, 1);
    soldLine($first, 'Sisig', 'Regular', 22000, 1);

    $unpaid = soldOrder(18000, payment: PaymentStatus::Unpaid, status: OrderStatus::Pending);
    soldLine($unpaid, 'Lumpia', 'Regular', 18000, 9);

    $response = $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertOk()
        ->assertJsonPath('data.top_items.0.name', 'Adobo')
        ->assertJsonPath('data.top_items.0.quantity', 3)
        ->assertJsonPath('data.top_items.0.sales', 60000)
        ->assertJsonPath('data.top_items.1.name', 'Sisig');

    expect($response->json('data.top_items'))->toHaveCount(2);
});

test('only an admin reads the money', function () {
    $this->getJson('/api/v1/admin/reports/summary')->assertUnauthorized();

    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertForbidden();

    $this->actingAs(User::factory()->kitchen()->create())
        ->getJson('/api/v1/admin/reports/summary')
        ->assertForbidden();
});

test('staff are told whether the reports are theirs to open', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.view_reports', true);

    $this->actingAs(User::factory()->cashier()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.view_reports', false);
});
```

- [ ] **Step 2: Run the test to watch it fail**

Run: `php artisan test --compact tests/Feature/Reports/SalesReportTest.php`
Expected: FAIL — 404 on `/api/v1/admin/reports/summary`.

- [ ] **Step 3: Write `app/Services/SalesReport.php`**

```php
<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;

/**
 * Every number the dashboard shows, read in one pass. Sales mean paid orders:
 * an order nobody paid for never becomes money.
 */
class SalesReport
{
    /**
     * @return array{
     *     today: array{date: string, sales: int, orders: int, paid_orders: int, cancelled_orders: int, average_order: int},
     *     days: list<array{date: string, label: string, sales: int, orders: int}>,
     *     top_items: list<array{name: string, quantity: int, sales: int}>
     * }
     */
    public function summary(int $span = 7): array
    {
        $timezone = (string) config('restaurant.timezone');
        $today = Date::now($timezone);
        $todayDate = $today->toDateString();
        $from = $today->subDays($span - 1)->toDateString();

        return [
            'today' => $this->today($todayDate),
            'days' => $this->days($from, $todayDate, $span, $timezone),
            'top_items' => $this->topItems($from, $todayDate),
        ];
    }

    /**
     * @return array{date: string, sales: int, orders: int, paid_orders: int, cancelled_orders: int, average_order: int}
     */
    private function today(string $date): array
    {
        $paid = Order::query()
            ->where('business_date', $date)
            ->where('payment_status', PaymentStatus::Paid);

        $sales = (int) (clone $paid)->sum('total');
        $paidOrders = (clone $paid)->count();

        return [
            'date' => $date,
            'sales' => $sales,
            'orders' => Order::query()->where('business_date', $date)->count(),
            'paid_orders' => $paidOrders,
            'cancelled_orders' => Order::query()
                ->where('business_date', $date)
                ->where('status', OrderStatus::Cancelled)
                ->count(),
            'average_order' => $paidOrders === 0 ? 0 : intdiv($sales, $paidOrders),
        ];
    }

    /**
     * Every day in the window, including the ones nobody bought anything on.
     *
     * @return list<array{date: string, label: string, sales: int, orders: int}>
     */
    private function days(string $from, string $to, int $span, string $timezone): array
    {
        $rows = DB::table('orders')
            ->where('payment_status', PaymentStatus::Paid->value)
            ->whereBetween('business_date', [$from, $to])
            ->groupBy('business_date')
            ->selectRaw('business_date, SUM(total) as sales, COUNT(*) as orders')
            ->get()
            ->keyBy('business_date');

        $days = [];

        for ($back = $span - 1; $back >= 0; $back--) {
            $day = Date::now($timezone)->subDays($back);
            $date = $day->toDateString();
            $row = $rows->get($date);

            $days[] = [
                'date' => $date,
                'label' => $day->format('D'),
                'sales' => (int) ($row->sales ?? 0),
                'orders' => (int) ($row->orders ?? 0),
            ];
        }

        return $days;
    }

    /**
     * The busiest dishes of the window, with their sizes added together.
     *
     * @return list<array{name: string, quantity: int, sales: int}>
     */
    private function topItems(string $from, string $to): array
    {
        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', PaymentStatus::Paid->value)
            ->whereBetween('orders.business_date', [$from, $to])
            ->groupBy('order_items.item_name')
            ->selectRaw('order_items.item_name as name, SUM(order_items.quantity) as quantity, SUM(order_items.line_total) as sales')
            ->orderByDesc('quantity')
            ->orderBy('order_items.item_name')
            ->take(5)
            ->get()
            ->map(fn (object $row): array => [
                'name' => (string) $row->name,
                'quantity' => (int) $row->quantity,
                'sales' => (int) $row->sales,
            ])
            ->all();
    }
}
```

- [ ] **Step 4: Write the controller, the route and the ability**

`app/Http/Controllers/Admin/ReportsController.php`:

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SalesReport;
use Illuminate\Http\JsonResponse;

class ReportsController extends Controller
{
    /**
     * The dashboard's whole read. The route group already keeps this to admins.
     */
    public function __invoke(SalesReport $report): JsonResponse
    {
        return response()->json(['data' => $report->summary()]);
    }
}
```

In `routes/api.php`, inside the `role:admin` group:

```php
            Route::get('/reports/summary', ReportsController::class)->name('reports.summary');
```

In `app/Http/Controllers/CurrentUserController.php`:

```php
                'view_reports' => $user->isAdmin(),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `php artisan test --compact tests/Feature/Reports/SalesReportTest.php`
Expected: PASS (6 tests).

Run: `vendor/bin/pint --dirty --format agent`
Run: `composer types:check`

---

### Task 2: Room for the chart in the CSP

**Files:**

- Modify: `app/Http/Middleware/SecurityHeaders.php`
- Test: `tests/Feature/SecurityHeadersTest.php`

**Interfaces:**

- Produces: a production CSP that carries `style-src-attr 'unsafe-inline'` while `style-src` keeps `'self'` and the nonce.

- [ ] **Step 1: Add the failing assertions**

In `tests/Feature/SecurityHeadersTest.php`, add:

```php
test('inline style attributes are allowed, but injected stylesheets are not', function () {
    $policy = $this->get('/')->headers->get('Content-Security-Policy') ?? '';

    expect($policy)->toContain("style-src-attr 'unsafe-inline'")
        ->and($policy)->not->toContain("style-src 'self' 'unsafe-inline'")
        ->and($policy)->toContain("script-src 'self' 'nonce-");
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `php artisan test --compact tests/Feature/SecurityHeadersTest.php`
Expected: FAIL — the directive is missing.

- [ ] **Step 3: Add the directive**

In `app/Http/Middleware/SecurityHeaders.php`, after the `style-src` line:

```php
            // Recharts writes inline style attributes on its own wrappers. This
            // allows the attribute and nothing else: <style> blocks and
            // stylesheets still need 'self' or the nonce, and scripts are
            // untouched.
            "style-src-attr 'unsafe-inline'",
```

- [ ] **Step 4: Run the suite**

Run: `php artisan test --compact tests/Feature/SecurityHeadersTest.php`
Expected: PASS.

Run: `vendor/bin/pint --dirty --format agent`

---

### Task 3: The dashboard's numbers

**Files:**

- Create: `resources/js/types/report.ts`, `resources/js/lib/reports.ts`, `resources/js/components/reports/stat-tile.tsx`
- Modify: `resources/js/types/index.ts`, `resources/js/pages/admin/dashboard.tsx`, `resources/js/router.tsx`

**Interfaces:**

- Produces: `fetchReportSummary()`, `reportsLoader()`, `<StatTile label value sub />`, and a dashboard that refreshes every 60s while visible.

- [ ] **Step 1: Write the types**

`resources/js/types/report.ts`:

```ts
export type DaySales = {
    date: string;
    label: string;
    sales: number;
    orders: number;
};

export type TopItem = {
    name: string;
    quantity: number;
    sales: number;
};

export type ReportSummary = {
    today: {
        date: string;
        sales: number;
        orders: number;
        paid_orders: number;
        cancelled_orders: number;
        average_order: number;
    };
    days: DaySales[];
    top_items: TopItem[];
};
```

and add `export type * from './report';` to `resources/js/types/index.ts`.

- [ ] **Step 2: Write `resources/js/lib/reports.ts`**

```ts
import { http } from '@/lib/http';
import type { ReportSummary } from '@/types';

type Wrapped<T> = { data: T };

export async function fetchReportSummary(): Promise<ReportSummary> {
    const response = await http.get<Wrapped<ReportSummary>>(
        '/api/v1/admin/reports/summary',
    );

    return response.data;
}

/** Loader: everything the dashboard shows. */
export function reportsLoader(): Promise<ReportSummary> {
    return fetchReportSummary();
}
```

- [ ] **Step 3: Write `resources/js/components/reports/stat-tile.tsx`**

A headline number is not a chart: one big figure, a quiet label, and one line of context beneath it.

```tsx
type StatTileProps = {
    label: string;
    value: string;
    sub?: string;
};

export function StatTile({ label, value, sub }: StatTileProps) {
    return (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl leading-none font-bold">{value}</p>
            {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
    );
}
```

- [ ] **Step 4: Rewrite `resources/js/pages/admin/dashboard.tsx`**

Behaviour:

- `const initial = useLoaderData<typeof reportsLoader>()`, held in state, refetched every 60s with `document.hidden` skipped — the same pattern as `useStaffOrders`.
- Four tiles: **Sales today** (`formatPeso(today.sales)`, sub `N paid orders`), **Orders today** (`today.orders`, sub `N paid · N cancelled`), **Average per order** (`formatPeso(today.average_order)`), and **Dishes sold this week** (sum of `top_items` quantity) — the fourth tile is the week's headline so the top list beneath it has a number to belong to.
- Then `<SalesChart days={report.days} />` and the top-dish list: rank, name, quantity, and `formatPeso(sales)`, with an empty state ("No sales yet this week.").
- Wire the loader in `resources/js/router.tsx` on the admin index route: `{ index: true, loader: reportsLoader, lazy: page(() => import('@/pages/admin/dashboard')) }`.

- [ ] **Step 5: Verify**

Run: `npm run check:fix`, `npm run types:check`, `npm test`
Expected: clean.

---

### Task 4: The week's bars

**Files:**

- Create: `resources/js/components/reports/sales-chart.tsx`
- Modify: `resources/css/app.css` (the `--chart-sales` token)

**Interfaces:**

- Consumes: `DaySales[]`, `formatPeso`.
- Produces: `<SalesChart days={...} />` — a bar per day, a tooltip per bar, and the same numbers as a table.

- [ ] **Step 1: Add the chart colour token**

In `resources/css/app.css`, in `:root`:

```css
/* Deeper kalamansi: the brand green fails contrast on a white card, this
       step passes the dataviz validator's six checks. */
--chart-sales: #7d9130;
```

and inside `@theme inline`:

```css
--color-chart-sales: var(--chart-sales);
```

- [ ] **Step 2: Write `resources/js/components/reports/sales-chart.tsx`**

Rules this follows, from the dataviz skill: one series means no legend (the heading names it); bars are thin with 4px rounded tops anchored to the baseline; the grid is recessive and horizontal only; there are no labels on every bar — the tooltip carries the detail; and the same data is available as a table for anyone who cannot read bars.

```tsx
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatPeso } from '@/lib/money';
import type { DaySales } from '@/types';

/** ₱1,250 → "₱1.3k", so the axis stays narrow. */
function shortPeso(centavos: number): string {
    const pesos = centavos / 100;

    return pesos >= 1000
        ? `₱${(pesos / 1000).toFixed(1)}k`
        : `₱${Math.round(pesos)}`;
}

function DayTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: { payload: DaySales }[];
}) {
    const day = payload?.[0]?.payload;

    if (active !== true || day === undefined) {
        return null;
    }

    return (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
            <p className="font-semibold">{day.label}</p>
            <p>{formatPeso(day.sales)}</p>
            <p className="text-muted-foreground">
                {day.orders} {day.orders === 1 ? 'order' : 'orders'}
            </p>
        </div>
    );
}

export function SalesChart({ days }: { days: DaySales[] }) {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">Sales, last 7 days</h2>

            <div aria-hidden="true" className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={days}
                        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    >
                        <CartesianGrid
                            vertical={false}
                            stroke="var(--color-border)"
                        />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{
                                fill: 'var(--color-muted-foreground)',
                                fontSize: 12,
                            }}
                        />
                        <YAxis
                            width={56}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={shortPeso}
                            tick={{
                                fill: 'var(--color-muted-foreground)',
                                fontSize: 12,
                            }}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--color-muted)' }}
                            content={<DayTooltip />}
                        />
                        <Bar
                            dataKey="sales"
                            fill="var(--color-chart-sales)"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={44}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <details className="text-sm">
                <summary className="min-h-11 cursor-pointer py-2 font-medium">
                    Show as table
                </summary>

                <table className="w-full text-left">
                    <caption className="sr-only">
                        Sales for the last seven days
                    </caption>
                    <thead>
                        <tr className="text-muted-foreground">
                            <th scope="col" className="py-1 font-medium">
                                Day
                            </th>
                            <th scope="col" className="py-1 font-medium">
                                Orders
                            </th>
                            <th
                                scope="col"
                                className="py-1 text-right font-medium"
                            >
                                Sales
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {days.map((day) => (
                            <tr
                                key={day.date}
                                className="border-t border-border"
                            >
                                <th scope="row" className="py-1 font-normal">
                                    {day.label}
                                </th>
                                <td className="py-1">{day.orders}</td>
                                <td className="py-1 text-right">
                                    {formatPeso(day.sales)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}
```

- [ ] **Step 3: Verify**

Run: `npm run check:fix`, `npm run types:check`, `npm test`, `npm run build`
Expected: clean, and the admin chunk grows while the customer entry does not.

---

### Task 5: Module gate

- [ ] **Step 1: Every automated check**

Run: `php artisan test --compact`, `composer types:check`, `composer lint:check`, `npm test`, `npm run types:check`, `npm run check`, `npm run build`

- [ ] **Step 2: The invariants**

Run: `php artisan route:list --path=api/v1/admin/reports --except-vendor`
Expected: one GET route behind `auth:sanctum`, `active`, `password.changed`, `role:admin`.

Run: `grep -rn "unsafe-inline" app/Http/Middleware/SecurityHeaders.php`
Expected: the dev-only `style-src` branch and the new `style-src-attr` line — nothing else.

- [ ] **Step 3: User walkthrough**

As an admin with `composer run dev`: open `/admin`, confirm the four tiles, the bars and the top-dish list. Mark an order paid in `/admin/orders` and watch the dashboard pick it up within a minute without a reload. Sign in as a cashier and confirm the dashboard shows no money (403 → the page should not be reachable from the nav).

- [ ] **Step 4: Production CSP check — the point of Task 2**

Stop the dev server, `Remove-Item public/hot`, `npm run build`, `php artisan serve`, then open `/admin` with the console open. Expected: the bars render and there is **no** `Refused to apply inline style` message.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: sales dashboard with the week's chart and top dishes"
```
