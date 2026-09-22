# Module 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Working agreement for this project:** the user types every command. Claude guides one step per message, gives a one-sentence explanation, and waits for the output before the next step.

**Goal:** Turn the Inertia React starter into a Laravel REST API (`/api/v1`) + Sanctum cookie-auth + React Router SPA with shadcn/ui and the Bilao theme, on MySQL.

**Architecture:** Laravel serves a single Blade shell (`app.blade.php`) for every non-API GET path, and React Router takes over in the browser. Staff auth uses Breeze's `api` stack: session endpoints (`/login`, `/logout`, …) plus Sanctum's stateful middleware on `/api/v1/*`, so no token is ever stored in JS.

**Tech Stack:** Laravel 13, PHP 8.4, Breeze 2.x (`api` stack), Sanctum, MySQL, Pest 5, React 19, TypeScript, React Router 8, Tailwind CSS 4, shadcn/ui, Vite (vite-plus `vp`).

**Spec:** `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md`

## Global Constraints

- API routes live in `routes/api.php` and are served under `/api/v1`.
- Auth is Sanctum SPA **cookie** auth. No bearer tokens in `localStorage`.
- Money is integer centavos (not used yet in this module).
- Keep the `VerifyCsrfToken`/CSRF protection active; never add routes to `$except`.
- Tests: Pest, feature tests in `tests/Feature`, run with `php artisan test --compact`.
- After PHP edits: `vendor/bin/pint --dirty --format agent`.
- Do not add dependencies beyond those named in this plan without approval.
- Public `/register` is removed in Task 4, because only an Admin creates staff accounts (Module 1). **Module 1** also adds a `UserResource` for `/api/v1/user`.
- Security rules in `CLAUDE.md` → _Security Guidelines_ apply to every task.

## File Map

| File                                                                                                                                                                                   | Change            | Responsibility                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------- |
| `.env`, `.env.example`                                                                                                                                                                 | Modify            | App name, MySQL, `FRONTEND_URL`, Sanctum stateful domains              |
| `bootstrap/app.php`                                                                                                                                                                    | Replace           | Routing (`api/v1` prefix), stateful API middleware, no Inertia         |
| `app/Http/Middleware/HandleInertiaRequests.php`                                                                                                                                        | Delete            | Inertia only                                                           |
| `config/inertia.php`                                                                                                                                                                   | Delete            | Inertia only                                                           |
| `app/Providers/AppServiceProvider.php`                                                                                                                                                 | Merge             | Keep the starter's `configureDefaults()` + Breeze's reset-URL callback |
| `routes/web.php`                                                                                                                                                                       | Replace           | Auth routes + SPA catch-all                                            |
| `routes/api.php`, `routes/auth.php`, `app/Http/Controllers/Auth/*`, `app/Http/Requests/Auth/LoginRequest.php`, `app/Http/Middleware/EnsureEmailIsVerified.php`, `tests/Feature/Auth/*` | Created by Breeze | Staff session auth                                                     |
| `tests/Feature/SanctumSpaTest.php`                                                                                                                                                     | Create            | CSRF cookie + stateful API contract                                    |
| `tests/Feature/SpaShellTest.php`                                                                                                                                                       | Create            | Catch-all serves the shell; API 404s stay JSON                         |
| `tests/Feature/ExampleTest.php`                                                                                                                                                        | Delete (Task 3)   | Replaced by `SpaShellTest`; Breeze overwrites it in Task 2             |
| `resources/views/app.blade.php`                                                                                                                                                        | Replace           | Plain SPA shell                                                        |
| `resources/js/app.tsx`                                                                                                                                                                 | Replace           | React root + router                                                    |
| `resources/js/router.tsx`                                                                                                                                                              | Create            | Route table                                                            |
| `resources/js/pages/home.tsx`, `resources/js/pages/not-found.tsx`                                                                                                                      | Create            | Placeholder pages                                                      |
| `resources/js/pages/welcome.tsx`, `resources/js/actions/`, `resources/js/routes/`, `resources/js/wayfinder/`                                                                           | Delete            | Inertia/Wayfinder only                                                 |
| `resources/js/types/global.d.ts`                                                                                                                                                       | Modify            | Drop the Inertia module augmentation                                   |
| `vite.config.ts`, `package.json`, `pnpm-workspace.yaml`                                                                                                                                | Modify            | Drop the Inertia/Wayfinder plugins and packages                        |
| `app/Http/Middleware/SecurityHeaders.php`, `config/security.php`                                                                                                                       | Create            | CSP (nonce), security headers, HSTS in production                      |
| `tests/Feature/SecurityHeadersTest.php`, `tests/Feature/Auth/AuthHardeningTest.php`                                                                                                    | Create            | Security baseline contract                                             |
| `app/Http/Controllers/Auth/RegisteredUserController.php`                                                                                                                               | Delete            | Public registration is closed                                          |
| `components.json`                                                                                                                                                                      | Create            | shadcn config                                                          |
| `resources/css/app.css`                                                                                                                                                                | Replace           | Bilao tokens mapped to shadcn variables                                |
| `resources/js/components/ui/*`                                                                                                                                                         | Created by shadcn | Button, Card, Badge                                                    |

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
Expected: if `barriobistro_db` doesn't exist, Laravel asks _"Would you like to create it?"_ → **yes**. It then runs `create_users_table`, `create_cache_table`, `create_jobs_table`.

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
            <h1 className="text-2xl font-semibold">
                Wala rito ang hinahanap mo.
            </h1>
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

### Task 4: Security baseline

Closes the gaps Breeze leaves open and adds the defences that every later module relies on.

| Threat                                    | Defence in this task                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Anyone creating a staff account           | Public `/register` removed                                                           |
| Credential stuffing across many emails    | Per-IP `throttle:login` on top of Breeze's per-email+IP lock                         |
| Account enumeration via "forgot password" | Same response whether or not the email exists                                        |
| API scraping / abuse                      | `throttleApi()`: 60 requests/min per user or IP                                      |
| XSS, clickjacking, MIME sniffing          | `SecurityHeaders`: nonce-based CSP, `X-Frame-Options`, `nosniff`, HSTS in production |
| Session theft from the DB / plaintext     | Encrypted sessions, HttpOnly + SameSite=Lax cookie, Secure in production             |
| Mass assignment slipping through silently | `Model::shouldBeStrict()` outside production                                         |
| Weak passwords                            | `Password::min(12)`, plus `uncompromised()` in production                            |
| Cached authenticated pages                | `Cache-Control: no-store, private` when logged in                                    |

**Files:**

- Create: `app/Http/Middleware/SecurityHeaders.php`, `config/security.php`, `tests/Feature/SecurityHeadersTest.php`, `tests/Feature/Auth/AuthHardeningTest.php`
- Modify: `bootstrap/app.php`, `routes/auth.php`, `app/Providers/AppServiceProvider.php`, `app/Http/Controllers/Auth/PasswordResetLinkController.php`, `app/Http/Requests/Auth/LoginRequest.php`, `config/session.php`, `vite.config.ts`, `.env`, `.env.example`
- Rewrite: `tests/Feature/Auth/RegistrationTest.php` (it now proves registration is closed)
- Modify: `tests/Feature/Auth/PasswordResetTest.php` (12+ character password)
- Delete: `app/Http/Controllers/Auth/RegisteredUserController.php`

**Interfaces:**

- Consumes: `spa` catch-all (Task 3), the Breeze auth routes (Task 2).
- Produces: rate limiters `api` and `login`; middleware `App\Http\Middleware\SecurityHeaders` (global); config key `security.csp_report_only`.

- [ ] **Step 1: Write the failing security header tests**

`tests/Feature/SecurityHeadersTest.php`:

```php
<?php

test('html responses carry a strict nonce-based content security policy', function () {
    $first = $this->withoutVite()->get('/')->headers->get('Content-Security-Policy');
    $second = $this->withoutVite()->get('/')->headers->get('Content-Security-Policy');

    expect($first)->not->toBeNull()
        ->and($first)->not->toBe($second)
        ->and($first)->toContain("default-src 'self'")
        ->and($first)->toContain("script-src 'self' 'nonce-")
        ->and($first)->toContain("object-src 'none'")
        ->and($first)->toContain("frame-ancestors 'none'")
        ->and($first)->toContain("form-action 'self'")
        ->and($first)->not->toContain("'unsafe-inline'")
        ->and($first)->not->toContain("'unsafe-eval'");
});

test('every response carries the baseline security headers', function (string $uri) {
    $this->withoutVite()
        ->get($uri)
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin');
})->with(['/', '/api/v1/user']);

test('json responses do not carry a content security policy', function () {
    $this->getJson('/api/v1/user')->assertHeaderMissing('Content-Security-Policy');
});

test('hsts is not sent over plain http outside production', function () {
    $this->withoutVite()->get('/')->assertHeaderMissing('Strict-Transport-Security');
});

test('the session cookie is http-only, same-site lax, and sessions are encrypted', function () {
    $sessionCookie = collect($this->withoutVite()->get('/')->headers->getCookies())
        ->first(fn ($cookie) => $cookie->getName() === config('session.cookie'));

    expect($sessionCookie)->not->toBeNull()
        ->and($sessionCookie->isHttpOnly())->toBeTrue()
        ->and($sessionCookie->getSameSite())->toBe('lax')
        ->and(config('session.encrypt'))->toBeTrue();
});
```

- [ ] **Step 2: Write the failing auth hardening tests**

`tests/Feature/Auth/AuthHardeningTest.php`:

```php
<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

test('password reset requests do not reveal whether an account exists', function () {
    Notification::fake();
    $user = User::factory()->create();

    $known = $this->postJson('/forgot-password', ['email' => $user->email]);
    $unknown = $this->postJson('/forgot-password', ['email' => 'nobody@example.com']);

    $known->assertOk();
    $unknown->assertOk();
    expect($unknown->json())->toBe($known->json());
    Notification::assertSentTo($user, ResetPassword::class);
});

test('login is throttled per ip even when every attempt uses a different email', function () {
    foreach (range(1, 20) as $attempt) {
        $this->postJson('/login', [
            'email' => "guess{$attempt}@example.com",
            'password' => 'wrong-password',
        ])->assertUnprocessable();
    }

    $this->postJson('/login', [
        'email' => 'guess21@example.com',
        'password' => 'wrong-password',
    ])->assertTooManyRequests();
});

test('the api is rate limited per client', function () {
    foreach (range(1, 60) as $attempt) {
        $this->getJson('/api/v1/user')->assertUnauthorized();
    }

    $this->getJson('/api/v1/user')->assertTooManyRequests();
});

test('passwords shorter than 12 characters are rejected', function () {
    $validate = fn (string $password): bool => Validator::make(
        ['password' => $password],
        ['password' => Password::defaults()],
    )->passes();

    expect($validate('short-pass1'))->toBeFalse()
        ->and($validate('a-long-enough-passphrase'))->toBeTrue();
});

test('unexpected attributes throw instead of being silently discarded', function () {
    expect(fn () => new User(['name' => 'Juan', 'is_admin' => true]))
        ->toThrow(MassAssignmentException::class);
});
```

Rewrite `tests/Feature/Auth/RegistrationTest.php`:

```php
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
```

In `tests/Feature/Auth/PasswordResetTest.php`, in the `'password can be reset with valid token'` test, change both `'password' => 'password'` and `'password_confirmation' => 'password'` to `'a-long-enough-passphrase'`.

- [ ] **Step 3: Run them to verify they fail**

Run: `php artisan test --compact tests/Feature/SecurityHeadersTest.php tests/Feature/Auth`
Expected: FAIL. There are no security headers yet, registration still succeeds (204), the unknown email returns 422, there are no 429s, `short-pass1` passes, and the mass-assignment test doesn't throw.

- [ ] **Step 4: Create `config/security.php`**

```php
<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Content Security Policy Report-Only Mode
    |--------------------------------------------------------------------------
    |
    | When true, the CSP is sent as "Content-Security-Policy-Report-Only": the
    | browser logs violations but blocks nothing. Use it only while rolling
    | out a policy change, then switch back to enforcing mode.
    |
    */

    'csp_report_only' => (bool) env('CSP_REPORT_ONLY', false),

];
```

- [ ] **Step 5: Create `app/Http/Middleware/SecurityHeaders.php`**

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    /**
     * Add security headers and a per-request nonce-based Content Security Policy.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $nonce = Vite::useCspNonce();

        $response = $next($request);

        $response->headers->add([
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
            'Cross-Origin-Opener-Policy' => 'same-origin',
            'X-Permitted-Cross-Domain-Policies' => 'none',
        ]);

        if ($request->secure() && app()->isProduction()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        if (str_contains((string) $response->headers->get('Content-Type'), 'text/html')) {
            $cspHeader = config('security.csp_report_only')
                ? 'Content-Security-Policy-Report-Only'
                : 'Content-Security-Policy';

            $response->headers->set($cspHeader, $this->contentSecurityPolicy($nonce));
        }

        if ($request->user() !== null) {
            $response->headers->set('Cache-Control', 'no-store, private');
        }

        return $response;
    }

    /**
     * Build the policy; the local environment also allows the Vite dev server and its injected styles.
     */
    private function contentSecurityPolicy(string $nonce): string
    {
        $devServer = $this->viteDevServerUrl();
        $devSources = $devServer === null ? '' : ' '.$devServer;
        $devSocket = $devServer === null ? '' : ' '.preg_replace('/^http/', 'ws', $devServer);

        $styleSources = $devServer === null
            ? "'self' 'nonce-{$nonce}'"
            : "'self' 'unsafe-inline'{$devSources}";

        return implode('; ', array_filter([
            "default-src 'self'",
            "script-src 'self' 'nonce-{$nonce}' 'strict-dynamic'",
            "style-src {$styleSources}",
            "img-src 'self' data: blob:{$devSources}",
            "font-src 'self' data:{$devSources}",
            "connect-src 'self'{$devSources}{$devSocket}",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            app()->isProduction() ? 'upgrade-insecure-requests' : null,
        ]));
    }

    /**
     * The Vite dev server origin, only when running locally with `npm run dev`.
     */
    private function viteDevServerUrl(): ?string
    {
        if (! app()->isLocal() || ! Vite::isRunningHot()) {
            return null;
        }

        return rtrim(trim((string) file_get_contents(Vite::hotFile())), '/');
    }
}
```

- [ ] **Step 6: Register the middleware and API throttling in `bootstrap/app.php`**

Add `use App\Http\Middleware\SecurityHeaders;` to the imports, then make the middleware closure:

```php
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(SecurityHeaders::class);

        $middleware->statefulApi();
        $middleware->throttleApi();

        $middleware->web(append: [
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'verified' => EnsureEmailIsVerified::class,
        ]);
    })
```

- [ ] **Step 7: Harden `AppServiceProvider`**

Replace `boot()` and `configureDefaults()`, and add `configureRateLimiting()`. The new imports are `Illuminate\Cache\RateLimiting\Limit`, `Illuminate\Database\Eloquent\Model`, `Illuminate\Http\Request` and `Illuminate\Support\Facades\RateLimiter`.

```php
    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRateLimiting();

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

        Model::shouldBeStrict(! app()->isProduction());

        Password::defaults(fn (): Password => app()->isProduction()
            ? Password::min(12)->uncompromised()
            : Password::min(12),
        );
    }

    /**
     * Define the rate limiters used by the API and the authentication routes.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', fn (Request $request): Limit => Limit::perMinute(60)
            ->by($request->user()?->getAuthIdentifier() ?: $request->ip()));

        RateLimiter::for('login', fn (Request $request): Limit => Limit::perMinute(20)
            ->by($request->ip()));
    }
```

- [ ] **Step 8: Close registration and throttle the auth routes in `routes/auth.php`**

Delete the `use App\Http\Controllers\Auth\RegisteredUserController;` line and the whole `Route::post('/register', …)` block, then delete `app/Http/Controllers/Auth/RegisteredUserController.php`.
Change the middleware of these three routes:

```php
Route::post('/login', [AuthenticatedSessionController::class, 'store'])
    ->middleware(['guest', 'throttle:login'])
    ->name('login');

Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])
    ->middleware(['guest', 'throttle:login'])
    ->name('password.email');

Route::post('/reset-password', [NewPasswordController::class, 'store'])
    ->middleware(['guest', 'throttle:login'])
    ->name('password.store');
```

- [ ] **Step 9: Stop the password reset endpoint from leaking account existence**

`app/Http/Controllers/Auth/PasswordResetLinkController.php`:

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;

class PasswordResetLinkController extends Controller
{
    /**
     * Send a reset link if the email belongs to a staff account, answering identically either way.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);

        Password::sendResetLink($request->only('email'));

        return response()->json([
            'status' => __('If that email belongs to a staff account, a reset link is on its way.'),
        ]);
    }
}
```

In `app/Http/Requests/Auth/LoginRequest.php` → `rules()`, bound the inputs:

```php
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ];
```

- [ ] **Step 10: Encrypt sessions by default**

`config/session.php` line 50:

```php
    'encrypt' => env('SESSION_ENCRYPT', true),
```

In both `.env` and `.env.example`, set `SESSION_ENCRYPT=true`. Add these lines under it in `.env.example` only:

```dotenv
# Production: must be true (cookie only over HTTPS)
SESSION_SECURE_COOKIE=
```

- [ ] **Step 11: Pin the Vite dev server to IPv4**

CSP host sources can't express IPv6 literals like `[::1]`, so in `vite.config.ts`, add `host: '127.0.0.1',` as the first key inside `server: { … }`.

- [ ] **Step 12: Run the tests**

Run: `php artisan test --compact tests/Feature/SecurityHeadersTest.php tests/Feature/Auth`
Expected: PASS.

- [ ] **Step 13: Check the policy doesn't break the real page**

Run: `composer run dev`, open `http://localhost:8000/`, and open DevTools → Console.
Expected: the page renders, hot reload works, and there are **no** "Refused to load / execute … Content Security Policy" errors. If there are, copy the exact console line; don't loosen the policy blindly.

- [ ] **Step 14: Review every route**

Run: `php artisan route:list --except-vendor`
Expected: no `register` route; `login`, `password.email` and `password.store` show `throttle:login`; the `api/v1/user` route shows `auth:sanctum`.

- [ ] **Step 15: Full suite, format, commit**

```bash
php artisan test --compact
vendor/bin/pint --dirty --format agent
git add -A
git commit -m "feat: security baseline - CSP and headers, rate limits, closed registration, encrypted sessions"
```

---

### Task 5: shadcn/ui + Bilao theme

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
                <Badge className="w-fit bg-kalamansi text-uling">
                    Bukas ngayon
                </Badge>
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

### Task 6: Module 0 gate

**Files:** none (verification only)

- [ ] **Step 0: Scan dependencies for known vulnerabilities**

Run: `composer audit`, then `npm audit --audit-level=high`
Expected: no high or critical advisories. If any appear, stop and report them before continuing.

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
