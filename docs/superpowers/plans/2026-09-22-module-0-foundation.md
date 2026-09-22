# Module 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Working agreement for this project:** the user types every command. Claude guides one step per message, gives a one-sentence explanation, and waits for the output before the next step.

**Goal:** Turn the Inertia React starter into a Laravel REST API (`/api/v1`) + Sanctum cookie-auth + React Router SPA with shadcn/ui and the Bilao theme, on MySQL.

**Architecture:** Laravel serves a single Blade shell (`app.blade.php`) for every non-API GET path, and React Router takes over in the browser. Staff auth uses Breeze's `api` stack: session endpoints (`/login`, `/logout`, …) plus Sanctum's stateful middleware on `/api/v1/*`, so no token is ever stored in JS.

**Tech Stack:** Laravel 13, PHP 8.4, Breeze 2.x (`api` stack), Sanctum, MySQL, Pest 5, React 19, TypeScript, React Router 7, Tailwind CSS 4, shadcn/ui, Vite (vite-plus `vp`).

**Spec:** `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md`

## Global Constraints

- API routes live in `routes/api.php` and are served under `/api/v1`.
- Auth is Sanctum SPA **cookie** auth. No bearer tokens in `localStorage`.
- Money is integer centavos (not used yet in this module).
- Keep the `VerifyCsrfToken`/CSRF protection active; never add routes to `$except`.
- Tests: Pest, feature tests in `tests/Feature`, run with `php artisan test --compact`.
- After PHP edits: `vendor/bin/pint --dirty --format agent`.
- Do not add dependencies beyond those named in this plan without approval.
- Registration stays as Breeze installs it in this module. **Module 1** removes public `/register` (staff-only accounts) and adds a `UserResource` for `/api/v1/user`.

## File Map

| File | Change | Responsibility |
|---|---|---|
| `.env`, `.env.example` | Modify | App name, MySQL, `FRONTEND_URL`, Sanctum stateful domains |
| `bootstrap/app.php` | Replace | Routing (`api/v1` prefix), stateful API middleware, no Inertia |
| `app/Http/Middleware/HandleInertiaRequests.php` | Delete | Inertia only |
| `config/inertia.php` | Delete | Inertia only |
| `app/Providers/AppServiceProvider.php` | Merge | Keep the starter's `configureDefaults()` + Breeze's reset-URL callback |
| `routes/web.php` | Replace | Auth routes + SPA catch-all |
| `routes/api.php`, `routes/auth.php`, `app/Http/Controllers/Auth/*`, `app/Http/Requests/Auth/LoginRequest.php`, `app/Http/Middleware/EnsureEmailIsVerified.php`, `tests/Feature/Auth/*` | Created by Breeze | Staff session auth |
| `tests/Feature/SanctumSpaTest.php` | Create | CSRF cookie + stateful API contract |
| `tests/Feature/SpaShellTest.php` | Create | Catch-all serves the shell; API 404s stay JSON |
| `tests/Feature/ExampleTest.php` | Delete (Task 3) | Replaced by `SpaShellTest`; Breeze overwrites it in Task 2 |
| `resources/views/app.blade.php` | Replace | Plain SPA shell |
| `resources/js/app.tsx` | Replace | React root + router |
| `resources/js/router.tsx` | Create | Route table |
| `resources/js/pages/home.tsx`, `resources/js/pages/not-found.tsx` | Create | Placeholder pages |
| `resources/js/pages/welcome.tsx`, `resources/js/actions/`, `resources/js/routes/`, `resources/js/wayfinder/` | Delete | Inertia/Wayfinder only |
| `resources/js/types/global.d.ts` | Modify | Drop the Inertia module augmentation |
| `vite.config.ts`, `package.json`, `pnpm-workspace.yaml` | Modify | Drop the Inertia/Wayfinder plugins and packages |
| `components.json` | Create | shadcn config |
| `resources/css/app.css` | Replace | Bilao tokens mapped to shadcn variables |
| `resources/js/components/ui/*` | Created by shadcn | Button, Card, Badge |

---

### Task 1: Baseline on MySQL

**Files:**
- Modify: `.env` (`APP_NAME`)
- Commit: `docs/`

**Interfaces:**
- Produces: a clean git baseline, and MySQL database `barriobistro_db` with the default migrations run.

- [ ] **Step 1: Commit the spec and plan**

```bash
git add docs
git commit -m "docs: add Barrio Bistro design spec and Module 0 plan"
```

- [ ] **Step 2: Set the app name in `.env`**

```dotenv
APP_NAME="Barrio Bistro"
```

- [ ] **Step 3: Start MySQL in Laragon, then run migrations**

Run: `php artisan migrate`
Expected: if `barriobistro_db` doesn't exist, Laravel asks *"Would you like to create it?"* → **yes**. It then runs `create_users_table`, `create_cache_table`, `create_jobs_table`.

- [ ] **Step 4: Confirm the baseline suite passes**

Run: `php artisan test --compact`
Expected: PASS (2 tests).

---

### Task 2: Replace Inertia with Breeze API + Sanctum

**Files:**
- Delete: `app/Http/Middleware/HandleInertiaRequests.php`, `config/inertia.php`
- Replace: `bootstrap/app.php`
- Merge: `app/Providers/AppServiceProvider.php`
- Modify: `.env`, `.env.example`
- Create: `tests/Feature/SanctumSpaTest.php`
- Created by Breeze: `routes/api.php`, `routes/auth.php`, `app/Http/Controllers/Auth/*`, `app/Http/Requests/Auth/LoginRequest.php`, `app/Http/Middleware/EnsureEmailIsVerified.php`, `tests/Feature/Auth/*`

**Interfaces:**
- Produces: `POST /login` and `POST /logout` (204), `GET /sanctum/csrf-cookie` (204 + `XSRF-TOKEN` cookie), and `GET /api/v1/user` (`auth:sanctum`) returning the user JSON or 401.

- [ ] **Step 1: Remove the Inertia server pieces**

Delete `app/Http/Middleware/HandleInertiaRequests.php` and `config/inertia.php`, then run:

```bash
composer remove inertiajs/inertia-laravel laravel/wayfinder
```

Expected: both packages removed; `package:discover` finishes without errors.

- [ ] **Step 2: Install Breeze and run its API stack**

```bash
composer require laravel/breeze --dev
php artisan breeze:install api --pest
```

Expected: Breeze runs `install:api` (Sanctum + `routes/api.php`). When asked to run pending migrations → **yes** (creates `personal_access_tokens`).
⚠️ Breeze **deletes** `package.json`, `package-lock.json`, `node_modules`, `resources/js`, and `resources/css`, and **overwrites** `app/Providers/AppServiceProvider.php` and `routes/web.php`. Steps 3–4 fix this.

- [ ] **Step 3: Restore the frontend files Breeze deleted**

```bash
git restore package.json package-lock.json resources/js resources/css
npm install
```

Expected: `git status` no longer shows those paths as deleted, and `node_modules` is back. They are converted in Task 3.

- [ ] **Step 4: Merge `AppServiceProvider` (keep both behaviours)**

`app/Providers/AppServiceProvider.php`:

```php
<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            return config('app.frontend_url')."/password-reset/{$token}?email={$notifiable->getEmailForPasswordReset()}";
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
```

- [ ] **Step 5: Replace `bootstrap/app.php`**

This removes Inertia, adds the `api/v1` prefix, and enables Sanctum's stateful middleware (`statefulApi()`). If Breeze already inserted its own middleware lines, this file supersedes them.

```php
<?php

use App\Http\Middleware\EnsureEmailIsVerified;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();

        $middleware->web(append: [
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'verified' => EnsureEmailIsVerified::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
```

- [ ] **Step 6: Point the SPA URLs at Laravel itself (same origin)**

Breeze sets `FRONTEND_URL=http://localhost:3000` (for a separate Next.js app). Our SPA is served by Laravel, so in **both** `.env` and `.env.example`:

```dotenv
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:8000
SANCTUM_STATEFUL_DOMAINS=localhost:8000,127.0.0.1:8000,barriobistro.test
```

Then confirm that `config/app.php` has `'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),` (Breeze adds it). If it is missing, add that line after `'url'`.

- [ ] **Step 7: Write the failing Sanctum SPA contract test**

Run: `php artisan make:test --pest SanctumSpaTest`, then set `tests/Feature/SanctumSpaTest.php` to:

```php
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
```

- [ ] **Step 8: Run it**

Run: `php artisan test --compact tests/Feature/SanctumSpaTest.php`
Expected: PASS. If `/api/v1/user` returns 404, Step 5's `apiPrefix` was not saved.

- [ ] **Step 9: Run the whole suite**

Run: `php artisan test --compact`
Expected: all PASS. Breeze overwrote `tests/Feature/ExampleTest.php` with its own `GET /` → 200 check, which passes against Breeze's JSON `/` route. Task 3 replaces that test.

- [ ] **Step 10: Format and commit**

```bash
vendor/bin/pint --dirty --format agent
git add -A
git commit -m "feat: replace Inertia with Breeze API and Sanctum SPA auth under /api/v1"
```

---

### Task 3: React SPA shell with React Router

**Files:**
- Replace: `routes/web.php`, `resources/views/app.blade.php`, `resources/js/app.tsx`
- Create: `resources/js/router.tsx`, `resources/js/pages/home.tsx`, `resources/js/pages/not-found.tsx`, `tests/Feature/SpaShellTest.php`
- Delete: `resources/js/pages/welcome.tsx`, `resources/js/actions/`, `resources/js/routes/`, `resources/js/wayfinder/`, `tests/Feature/ExampleTest.php`
- Modify: `resources/js/types/global.d.ts`, `vite.config.ts`, `package.json`, `pnpm-workspace.yaml`

**Interfaces:**
- Consumes: the auth routes in `routes/auth.php` (Task 2).
- Produces: `GET /{path?}` named `spa`, which renders view `app` for any path not under `api/`, `sanctum/` or `up`; a DOM mount point `#app`; and `resources/js/router.tsx` exporting `router`.

- [ ] **Step 1: Write the failing shell test**

Run: `php artisan make:test --pest SpaShellTest`, then set `tests/Feature/SpaShellTest.php` to:

```php
<?php

test('the home page serves the spa shell', function () {
    $this->withoutVite()
        ->get('/')
        ->assertOk()
        ->assertViewIs('app')
        ->assertSee('<div id="app"></div>', false);
});

test('deep links serve the spa shell so react router can handle them', function (string $path) {
    $this->withoutVite()
        ->get($path)
        ->assertOk()
        ->assertViewIs('app');
})->with(['/menu', '/menu/meals', '/admin/orders']);

test('unknown api paths return json 404 instead of the spa shell', function () {
    $this->getJson('/api/v1/does-not-exist')
        ->assertNotFound()
        ->assertJsonStructure(['message']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `php artisan test --compact tests/Feature/SpaShellTest.php`
Expected: FAIL. `/` returns Breeze's JSON (`assertViewIs` fails), and the deep links return 404.

- [ ] **Step 3: Replace `routes/web.php`**

The auth routes are registered **before** the catch-all, so `GET /verify-email/...` still reaches its controller.

```php
<?php

use Illuminate\Support\Facades\Route;

require __DIR__.'/auth.php';

Route::view('/{path?}', 'app')
    ->where('path', '(?!(api|sanctum|up)(/|$)).*')
    ->name('spa');
```

- [ ] **Step 4: Replace `resources/views/app.blade.php`**

```blade
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title>{{ config('app.name') }}</title>

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    </head>
    <body class="font-sans antialiased">
        <div id="app"></div>
    </body>
</html>
```

- [ ] **Step 5: Delete the old test and run the shell test**

Delete `tests/Feature/ExampleTest.php`; `SpaShellTest` replaces it.
Run: `php artisan test --compact tests/Feature/SpaShellTest.php`
Expected: PASS. If it fails with a Vite **fonts** manifest error, run `npm run build` once and re-run.

- [ ] **Step 6: Swap the JS packages**

```bash
npm uninstall @inertiajs/react @inertiajs/vite @laravel/vite-plugin-wayfinder
npm install react-router
```

- [ ] **Step 7: Delete the Inertia/Wayfinder frontend files**

Delete `resources/js/pages/welcome.tsx` and the folders `resources/js/actions/`, `resources/js/routes/` and `resources/js/wayfinder/`.

In `resources/js/types/global.d.ts`, delete the `import type { Auth } …` line and the whole `declare module '@inertiajs/core' { … }` block, keeping only:

```ts
declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

export {};
```

In `pnpm-workspace.yaml`, delete the `publicHoistPattern:` block (its only entry is `@inertiajs/core`).

In `package.json` → `scripts`, delete `"build:ssr"` (there's no SSR in Approach A).

- [ ] **Step 8: Update `vite.config.ts`**

Remove the two imports `import inertia from '@inertiajs/vite';` and `import { wayfinder } from '@laravel/vite-plugin-wayfinder';`. Then make the `plugins` block:

```ts
    plugins: lazyPlugins(() => [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        react(),
        babel({
            presets: [reactCompilerPreset()],
        }),
        tailwindcss(),
    ]),
```

In `lint.ignorePatterns`, delete these three lines: `'resources/js/actions/**'`, `'resources/js/routes/**'`, `'resources/js/wayfinder/**'`.

- [ ] **Step 9: Create the router and pages**

`resources/js/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router';
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';

export const router = createBrowserRouter([
    { path: '/', element: <Home /> },
    { path: '*', element: <NotFound /> },
]);
```

`resources/js/pages/home.tsx`:

```tsx
export default function Home() {
    return (
        <main className="flex min-h-screen items-center justify-center p-6">
            <h1 className="text-4xl font-semibold">Barrio Bistro</h1>
        </main>
    );
}
```

`resources/js/pages/not-found.tsx`:

```tsx
import { Link } from 'react-router';

export default function NotFound() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
            <h1 className="text-2xl font-semibold">Wala rito ang hinahanap mo.</h1>
            <Link to="/" className="underline">
                Bumalik sa home
            </Link>
        </main>
    );
}
```

- [ ] **Step 10: Replace `resources/js/app.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from '@/router';

const container = document.getElementById('app');

if (container) {
    createRoot(container).render(
        <StrictMode>
            <RouterProvider router={router} />
        </StrictMode>,
    );
}
```

- [ ] **Step 11: Verify the frontend builds and type-checks**

Run: `npm run types:check`, then `npm run build`, then `npm run check`
Expected: all three exit 0. Any leftover `@inertiajs` or `@/routes` import shows up here; delete it.

- [ ] **Step 12: See it in the browser**

Run: `composer run dev`, then open `http://localhost:8000/` → "Barrio Bistro"; open `http://localhost:8000/kahit-ano` → the not-found page with a working link home.

- [ ] **Step 13: Full suite, format, commit**

```bash
php artisan test --compact
vendor/bin/pint --dirty --format agent
git add -A
git commit -m "feat: serve React Router SPA shell and remove Inertia/Wayfinder frontend"
```

Expected: all tests PASS.

---

### Task 4: shadcn/ui + Bilao theme

**Files:**
- Create: `components.json`
- Replace: `resources/css/app.css`
- Modify: `vite.config.ts` (add a font), `resources/js/pages/home.tsx`
- Created by shadcn: `resources/js/components/ui/button.tsx`, `card.tsx`, `badge.tsx`

**Interfaces:**
- Consumes: `cn()` from `@/lib/utils` (it already exists).
- Produces: shadcn components at `@/components/ui/*`, Tailwind color utilities `bg-dahon`, `bg-pandan`, `bg-achuete`, `text-kalamansi`, `bg-ube`, `text-uling`, the shadcn semantic tokens (`bg-primary`, …) mapped to Bilao, and `font-display` (Bricolage Grotesque).

- [ ] **Step 1: Create `components.json`**

```json
{
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "new-york",
    "rsc": false,
    "tsx": true,
    "tailwind": {
        "config": "",
        "css": "resources/css/app.css",
        "baseColor": "neutral",
        "cssVariables": true,
        "prefix": ""
    },
    "aliases": {
        "components": "@/components",
        "utils": "@/lib/utils",
        "ui": "@/components/ui",
        "lib": "@/lib",
        "hooks": "@/hooks"
    },
    "iconLibrary": "lucide"
}
```

- [ ] **Step 2: Replace `resources/css/app.css` with the Bilao tokens**

```css
@import 'tailwindcss';

@source '../views';
@source '../../vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php';

:root {
    --dahon: #1f3d2b;
    --pandan: #edf0e6;
    --achuete: #e2571e;
    --kalamansi: #9cb43c;
    --ube: #5b3a8c;
    --uling: #17110f;

    --background: var(--pandan);
    --foreground: var(--uling);
    --card: #ffffff;
    --card-foreground: var(--uling);
    --popover: #ffffff;
    --popover-foreground: var(--uling);
    --primary: var(--achuete);
    --primary-foreground: #ffffff;
    --secondary: var(--dahon);
    --secondary-foreground: var(--pandan);
    --muted: #dfe4d6;
    --muted-foreground: #4a5245;
    --accent: var(--kalamansi);
    --accent-foreground: var(--uling);
    --destructive: #b42318;
    --border: #d3d9c8;
    --input: #d3d9c8;
    --ring: var(--achuete);
    --radius: 0.75rem;
}

@theme inline {
    --font-sans:
        'Instrument Sans', ui-sans-serif, system-ui, sans-serif,
        'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
        'Noto Color Emoji';
    --font-display: 'Bricolage Grotesque', var(--font-sans);

    --color-dahon: var(--dahon);
    --color-pandan: var(--pandan);
    --color-achuete: var(--achuete);
    --color-kalamansi: var(--kalamansi);
    --color-ube: var(--ube);
    --color-uling: var(--uling);

    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-card: var(--card);
    --color-card-foreground: var(--card-foreground);
    --color-popover: var(--popover);
    --color-popover-foreground: var(--popover-foreground);
    --color-primary: var(--primary);
    --color-primary-foreground: var(--primary-foreground);
    --color-secondary: var(--secondary);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --color-accent: var(--accent);
    --color-accent-foreground: var(--accent-foreground);
    --color-destructive: var(--destructive);
    --color-border: var(--border);
    --color-input: var(--input);
    --color-ring: var(--ring);

    --radius-sm: calc(var(--radius) - 4px);
    --radius-md: calc(var(--radius) - 2px);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
    * {
        @apply border-border;
    }

    body {
        @apply bg-background text-foreground;
    }
}
```

- [ ] **Step 3: Load Bricolage Grotesque**

In `vite.config.ts`, inside `laravel({ … fonts: [ … ] })`, add after the Instrument Sans entry:

```ts
                bunny('Bricolage Grotesque', {
                    weights: [400, 600, 800],
                }),
```

- [ ] **Step 4: Add the first shadcn components**

```bash
npx shadcn@latest add button card badge
```

Expected: it creates `resources/js/components/ui/{button,card,badge}.tsx` and installs its runtime deps (`class-variance-authority`, `@radix-ui/react-slot` or `radix-ui`, `lucide-react`). If it offers to overwrite `resources/css/app.css` or `lib/utils.ts` → **No**.

- [ ] **Step 5: Use the theme on the home placeholder**

`resources/js/pages/home.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function Home() {
    return (
        <main className="min-h-screen bg-dahon p-6 text-pandan">
            <div className="mx-auto flex max-w-4xl flex-col gap-6 py-24">
                <Badge className="w-fit bg-kalamansi text-uling">Bukas ngayon</Badge>
                <h1 className="font-display text-5xl font-extrabold leading-tight md:text-7xl">
                    Nasa kalan
                    <br />
                    ngayong hapon.
                </h1>
                <Button size="lg" className="w-fit">
                    Tingnan ang menu
                </Button>
            </div>
        </main>
    );
}
```

- [ ] **Step 6: Verify the build and look at it**

Run: `npm run types:check`, then `npm run build`, then `npm run check`. All three should exit 0.
Then `composer run dev` → `http://localhost:8000/`. Expected: a banana-leaf green ground, pandan text, the Bricolage display headline, a kalamansi badge, and an achuete button.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add shadcn/ui with Bilao theme tokens and display font"
```

---

### Task 5: Module 0 gate

**Files:** none (verification only)

- [ ] **Step 1: Run the project's full check**

Run: `composer run test`
Expected: Pint check, PHPStan, and all Pest tests PASS. Fix any PHPStan findings in the files touched by this module (commonly the Breeze controllers) before moving on.

- [ ] **Step 2: Run the frontend check**

Run: `npm run check && npm run types:check`
Expected: exit 0.

- [ ] **Step 3: Confirm there are no Inertia or Wayfinder leftovers**

Run: `git grep -n -i "inertia\|wayfinder" -- app bootstrap config routes resources tests vite.config.ts package.json composer.json`
Expected: no output.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: Module 0 foundation passes full checks"
```

**Done when:** `/` shows the Bilao placeholder, deep links render the SPA, `/api/v1/user` is 401 for guests and 200 after `/login`, and every check is green. Next: **Module 1 — Auth & RBAC**.
