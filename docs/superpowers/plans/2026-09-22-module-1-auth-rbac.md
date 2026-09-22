# Module 1 — Auth & RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Working agreement:** Claude writes and edits the code files. The user types every terminal command. Claude gives one step at a time with a one-sentence explanation and waits for the output. Commits are consolidated about every 5 steps into one short message.

**Goal:** Staff accounts with roles (Admin, Cashier, Kitchen), deactivation, forced change of admin-set temporary passwords, a three-layer authorization model, an audit trail, and the React login, change-password and staff management screens.

**Architecture:** `role`, `is_active`, `must_change_password` and `last_login_at` live on `users`. `role` and `is_active` are never mass-assignable. Every `/api/v1` route that needs a login runs `auth:sanctum` → `active` → `password.changed` → (`role:admin`) → Form Request `authorize()` via `UserPolicy`, and `Gate::before` grants active Admins every ability. Business rules (e.g. "you can't demote yourself") are validation errors (422). An append-only `audit_logs` table records auth events and staff changes, with passwords redacted. The React SPA uses route loaders that call `GET /api/v1/me` to guard pages.

**Tech Stack:** Laravel 13, Sanctum SPA cookie auth, Pest 5, React 19, React Router 8 (data loaders), shadcn/ui (Radix), Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md` (Sections 4 and 6)

## Global Constraints

- All API routes are under `/api/v1`. Responses go through API Resources (`UserResource`), never raw models.
- Never pass `$request->all()` to a model. Use `$request->validated()` / `$request->safe()->only([...])`.
- `role`, `is_active`, `must_change_password` are set only by explicit assignment in admin actions.
- A failed login never reveals whether the email exists or whether the account is deactivated. It always says `auth.failed`.
- Passwords: `Password::defaults()` (min 12, `uncompromised()` in production). Never log or return a password.
- Staff are never deleted (order history). Deactivate instead.
- Security rules in `CLAUDE.md` → _Security Guidelines_ apply to every task.
- After PHP edits: `vendor/bin/pint --dirty --format agent`. Tests: `php artisan test --compact`.
- New npm packages allowed in this module: the shadcn components (and the `radix-ui`/`lucide-react` they pull in), plus `get-nonce` (see Task 8). Nothing else.

## File Map

| File                                                                                                                                                                                                  | Change                | Responsibility                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------ |
| `app/Enums/Role.php`                                                                                                                                                                                  | Create                | `Admin`, `Cashier`, `Kitchen` + labels                       |
| `database/migrations/2026_09_22_100000_add_staff_columns_to_users_table.php`                                                                                                                          | Create                | `role`, `is_active`, `must_change_password`, `last_login_at` |
| `database/migrations/2026_09_22_100100_create_audit_logs_table.php`                                                                                                                                   | Create                | Append-only audit trail                                      |
| `app/Models/User.php`                                                                                                                                                                                 | Modify                | Casts, `hasRole()`, `isAdmin()`, `active` scope              |
| `app/Models/AuditLog.php`                                                                                                                                                                             | Create                | `record()`, `recordChange()`, redaction                      |
| `database/factories/UserFactory.php`                                                                                                                                                                  | Modify                | Role/state helpers; drop `unverified()`                      |
| `app/Providers/AppServiceProvider.php`                                                                                                                                                                | Modify                | `Gate::before`, auth-event audit listeners                   |
| `app/Http/Requests/Auth/LoginRequest.php`                                                                                                                                                             | Modify                | Refuse deactivated accounts with the generic message         |
| `app/Http/Controllers/Auth/AuthenticatedSessionController.php`                                                                                                                                        | Modify                | Stamp `last_login_at`                                        |
| `app/Http/Resources/UserResource.php`                                                                                                                                                                 | Create                | The only shape a user leaves the API in                      |
| `app/Http/Controllers/CurrentUserController.php`                                                                                                                                                      | Create                | `GET /api/v1/me`                                             |
| `app/Http/Controllers/CurrentUserPasswordController.php`, `app/Http/Requests/UpdateCurrentUserPasswordRequest.php`                                                                                    | Create                | `PUT /api/v1/me/password`                                    |
| `app/Http/Middleware/EnsureUserIsActive.php`, `EnsurePasswordIsChanged.php`, `EnsureUserHasRole.php`                                                                                                  | Create                | `active`, `password.changed`, `role:`                        |
| `app/Policies/UserPolicy.php`                                                                                                                                                                         | Create                | Staff management abilities                                   |
| `app/Http/Controllers/Admin/StaffController.php`, `StaffPasswordController.php`                                                                                                                       | Create                | Staff API                                                    |
| `app/Http/Requests/Admin/ListStaffRequest.php`, `StoreStaffRequest.php`, `UpdateStaffRequest.php`, `ResetStaffPasswordRequest.php`                                                                    | Create                | Staff validation + authorization                             |
| `app/Console/Commands/CreateAdminCommand.php`                                                                                                                                                         | Create                | `php artisan app:create-admin`                               |
| `routes/api.php`, `routes/auth.php`, `bootstrap/app.php`                                                                                                                                              | Modify                | Routes and middleware aliases                                |
| `app/Http/Controllers/Auth/VerifyEmailController.php`, `EmailVerificationNotificationController.php`, `app/Http/Middleware/EnsureEmailIsVerified.php`, `tests/Feature/Auth/EmailVerificationTest.php` | **Delete** (approved) | Email verification is not used                               |
| `database/seeders/DatabaseSeeder.php`                                                                                                                                                                 | Modify                | Demo staff in `local` only; no default admin                 |
| `resources/views/app.blade.php`, `resources/js/app.tsx`                                                                                                                                               | Modify                | Expose the CSP nonce to Radix                                |
| `resources/js/lib/http.ts`, `lib/auth.ts`, `lib/staff.ts`, `types/auth.ts`                                                                                                                            | Create/Replace        | API client, loaders, types                                   |
| `resources/js/components/form-field.tsx`, `components/staff/*`                                                                                                                                        | Create                | Form + dialogs                                               |
| `resources/js/pages/auth/login.tsx`, `pages/account/change-password.tsx`, `pages/admin/dashboard.tsx`, `pages/admin/staff.tsx`, `pages/route-error.tsx`, `layouts/admin-layout.tsx`                   | Create                | Screens                                                      |
| `resources/js/router.tsx`                                                                                                                                                                             | Modify                | Routes + loaders                                             |

---

### Task 1: Roles and staff columns

**Files:**

- Create: `app/Enums/Role.php`, `database/migrations/2026_09_22_100000_add_staff_columns_to_users_table.php`, `tests/Feature/UserRolesTest.php`
- Modify: `app/Models/User.php`, `database/factories/UserFactory.php`

**Interfaces:**

- Produces: `App\Enums\Role` (`Admin='admin'`, `Cashier='cashier'`, `Kitchen='kitchen'`, `label(): string`); `User::hasRole(Role ...$roles): bool`, `User::isAdmin(): bool`, `User::query()->active()`; factory states `admin()`, `cashier()`, `kitchen()`, `inactive()`, `mustChangePassword()`.

- [ ] **Step 1: Write the failing test** — `tests/Feature/UserRolesTest.php`

```php
<?php

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\MassAssignmentException;

test('staff roles are stored as the Role enum', function (string $state, Role $role) {
    $user = User::factory()->{$state}()->create();

    expect($user->fresh()->role)->toBe($role)
        ->and($user->hasRole($role))->toBeTrue();
})->with([
    'admin' => ['admin', Role::Admin],
    'cashier' => ['cashier', Role::Cashier],
    'kitchen' => ['kitchen', Role::Kitchen],
]);

test('new staff are active with no forced password change', function () {
    $user = User::factory()->create()->fresh();

    expect($user->is_active)->toBeTrue()
        ->and($user->must_change_password)->toBeFalse()
        ->and($user->last_login_at)->toBeNull();
});

test('privilege columns cannot be mass assigned', function (string $column, mixed $value) {
    expect(fn () => new User(['name' => 'Juan', $column => $value]))
        ->toThrow(MassAssignmentException::class);
})->with([
    'role' => ['role', 'admin'],
    'is_active' => ['is_active', true],
    'must_change_password' => ['must_change_password', false],
]);

test('only the admin role counts as admin', function () {
    expect(User::factory()->admin()->make()->isAdmin())->toBeTrue()
        ->and(User::factory()->cashier()->make()->isAdmin())->toBeFalse();
});

test('the active scope leaves out deactivated staff', function () {
    $active = User::factory()->create();
    User::factory()->inactive()->create();

    expect(User::query()->active()->pluck('id')->all())->toBe([$active->id]);
});
```

- [ ] **Step 2: Run it (FAIL)** — `php artisan test --compact tests/Feature/UserRolesTest.php` → fails: `Class "App\Enums\Role" not found`.

- [ ] **Step 3: Create `app/Enums/Role.php`**

```php
<?php

namespace App\Enums;

enum Role: string
{
    case Admin = 'admin';
    case Cashier = 'cashier';
    case Kitchen = 'kitchen';

    /**
     * Human-readable name shown in the admin UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Admin',
            self::Cashier => 'Cashier',
            self::Kitchen => 'Kitchen',
        };
    }
}
```

- [ ] **Step 4: Create the migration** — `database/migrations/2026_09_22_100000_add_staff_columns_to_users_table.php`

The default role is the least-privileged one, so a row that somehow skips assignment fails closed.

```php
<?php

use App\Enums\Role;
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
            $table->string('role', 20)->default(Role::Kitchen->value)->after('email');
            $table->boolean('is_active')->default(true)->after('role');
            $table->boolean('must_change_password')->default(false)->after('is_active');
            $table->timestamp('last_login_at')->nullable()->after('must_change_password');

            $table->index(['role', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role', 'is_active']);
            $table->dropColumn(['role', 'is_active', 'must_change_password', 'last_login_at']);
        });
    }
};
```

- [ ] **Step 5: Update `app/Models/User.php`**

Add these `@property` lines to the class docblock (after `$remember_token`):

```php
 * @property Role $role
 * @property bool $is_active
 * @property bool $must_change_password
 * @property Carbon|null $last_login_at
```

Keep `#[Fillable(['name', 'email', 'password'])]` exactly as it is (privilege columns stay out). Mirror the DB defaults in memory, otherwise strict mode throws `MissingAttributeException` when a freshly created user goes through `UserResource`:

```php
    /**
     * In-memory defaults that mirror the database, so a freshly created user is complete.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'role' => Role::Kitchen->value,
        'is_active' => true,
        'must_change_password' => false,
        'last_login_at' => null,
    ];
```

Add the imports `App\Enums\Role`, `Illuminate\Database\Eloquent\Attributes\Scope` and `Illuminate\Database\Eloquent\Builder`, then replace `casts()` and add the helpers:

```php
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'is_active' => 'boolean',
            'must_change_password' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    /**
     * Determine whether the user has any of the given roles.
     */
    public function hasRole(Role ...$roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    /**
     * Determine whether the user is an admin.
     */
    public function isAdmin(): bool
    {
        return $this->role === Role::Admin;
    }

    /**
     * Only staff whose accounts are active.
     *
     * @param  Builder<User>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('is_active', true);
    }
```

- [ ] **Step 6: Update `database/factories/UserFactory.php`**

Add `use App\Enums\Role;`. In `definition()` add `'role' => Role::Kitchen,`, `'is_active' => true` and `'must_change_password' => false` after `'email_verified_at'`. Replace the `unverified()` state with:

```php
    /**
     * Indicate that the user is an admin.
     */
    public function admin(): static
    {
        return $this->state(fn (array $attributes) => ['role' => Role::Admin]);
    }

    /**
     * Indicate that the user is a cashier.
     */
    public function cashier(): static
    {
        return $this->state(fn (array $attributes) => ['role' => Role::Cashier]);
    }

    /**
     * Indicate that the user works in the kitchen.
     */
    public function kitchen(): static
    {
        return $this->state(fn (array $attributes) => ['role' => Role::Kitchen]);
    }

    /**
     * Indicate that the account has been deactivated.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => ['is_active' => false]);
    }

    /**
     * Indicate that the user still has an admin-set temporary password.
     */
    public function mustChangePassword(): static
    {
        return $this->state(fn (array $attributes) => ['must_change_password' => true]);
    }
```

- [ ] **Step 7: Migrate and run the test (PASS)** — `php artisan migrate`, then `php artisan test --compact tests/Feature/UserRolesTest.php` → PASS. Then run the full suite: `EmailVerificationTest` may now fail (it uses `unverified()`). That is expected, and Task 3 deletes it.

---

### Task 2: Audit trail

**Files:**

- Create: `database/migrations/2026_09_22_100100_create_audit_logs_table.php`, `app/Models/AuditLog.php`, `tests/Feature/AuditLogTest.php`

**Interfaces:**

- Produces: `AuditLog::record(string $action, ?Model $subject = null, ?User $causer = null, array $context = [], array $changes = []): AuditLog` and `AuditLog::recordChange(string $action, Model $subject, ?User $causer = null): AuditLog`. The causer defaults to the signed-in user. Keys `password`, `password_confirmation`, `current_password`, `remember_token` and `token` are replaced by `[REDACTED]` at any depth.

- [ ] **Step 1: Write the failing test** — `tests/Feature/AuditLogTest.php`

```php
<?php

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;

test('an event records the actor, subject, origin and context', function () {
    $admin = User::factory()->admin()->create();
    $staff = User::factory()->create();
    $this->actingAs($admin);

    $log = AuditLog::record('staff.created', $staff, context: ['role' => 'kitchen']);

    expect($log->causer_id)->toBe($admin->id)
        ->and($log->subject_type)->toBe($staff->getMorphClass())
        ->and($log->subject_id)->toBe($staff->id)
        ->and($log->context)->toBe(['role' => 'kitchen'])
        ->and($log->ip_address)->toBe('127.0.0.1');
});

test('sensitive values are redacted at any depth', function () {
    $log = AuditLog::record('test.event', context: [
        'password' => 'hunter2-hunter2',
        'nested' => ['current_password' => 'secret-value', 'note' => 'kept'],
    ]);

    expect($log->context)->toBe([
        'password' => '[REDACTED]',
        'nested' => ['current_password' => '[REDACTED]', 'note' => 'kept'],
    ]);
});

test('a change records the before and after values of the last save', function () {
    $staff = User::factory()->cashier()->create();
    $staff->role = Role::Kitchen;
    $staff->save();

    $log = AuditLog::recordChange('staff.updated', $staff);

    expect($log->changes)->toBe(['role' => ['from' => 'cashier', 'to' => 'kitchen']]);
});

test('a password change is logged without the password', function () {
    $staff = User::factory()->create();
    $staff->forceFill(['password' => 'a-brand-new-passphrase'])->save();

    $log = AuditLog::recordChange('staff.updated', $staff);

    expect($log->changes['password'])->toBe('[REDACTED]');
});

test('audit entries are append-only', function () {
    expect(AuditLog::record('test.event')->getAttributes())->not->toHaveKey('updated_at');
});
```

- [ ] **Step 2: Run it (FAIL)** — `php artisan test --compact tests/Feature/AuditLogTest.php` → `Class "App\Models\AuditLog" not found`.

- [ ] **Step 3: Create the migration** — `database/migrations/2026_09_22_100100_create_audit_logs_table.php`

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
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('action', 64);
            $table->nullableMorphs('subject');
            $table->foreignId('causer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('context')->nullable();
            $table->json('changes')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['action', 'created_at']);
            $table->index(['causer_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
```

- [ ] **Step 4: Create `app/Models/AuditLog.php`**

```php
<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Auth;

/**
 * Append-only record of who did what, to which record, and from where.
 *
 * @property int $id
 * @property string $action
 * @property string|null $subject_type
 * @property int|null $subject_id
 * @property int|null $causer_id
 * @property array<string, mixed>|null $context
 * @property array<string, mixed>|null $changes
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property CarbonImmutable $created_at
 */
#[Fillable(['action', 'subject_type', 'subject_id', 'causer_id', 'context', 'changes', 'ip_address', 'user_agent'])]
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    /**
     * Keys whose values must never reach the audit trail.
     *
     * @var list<string>
     */
    private const REDACTED_KEYS = ['password', 'password_confirmation', 'current_password', 'remember_token', 'token'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'context' => 'array',
            'changes' => 'array',
            'created_at' => 'immutable_datetime',
        ];
    }

    /**
     * Record a security-relevant event; the causer defaults to the signed-in user.
     *
     * @param  array<string, mixed>  $context
     * @param  array<string, mixed>  $changes
     */
    public static function record(string $action, ?Model $subject = null, ?User $causer = null, array $context = [], array $changes = []): self
    {
        $request = request();
        $userAgent = $request->userAgent();

        return self::query()->create([
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'causer_id' => ($causer ?? Auth::user())?->getAuthIdentifier(),
            'context' => $context === [] ? null : self::redact($context),
            'changes' => $changes === [] ? null : self::redact($changes),
            'ip_address' => $request->ip(),
            'user_agent' => $userAgent === null ? null : mb_substr($userAgent, 0, 512),
        ]);
    }

    /**
     * Record an update as a before/after diff of the attributes changed by the last save.
     */
    public static function recordChange(string $action, Model $subject, ?User $causer = null): self
    {
        $previous = $subject->getPrevious();
        $changes = [];

        foreach ($subject->getChanges() as $attribute => $newValue) {
            if ($attribute === $subject->getUpdatedAtColumn()) {
                continue;
            }

            $changes[$attribute] = ['from' => $previous[$attribute] ?? null, 'to' => $newValue];
        }

        return self::record($action, $subject, $causer, changes: $changes);
    }

    /**
     * Replace sensitive values at any depth.
     *
     * @param  array<array-key, mixed>  $data
     * @return array<array-key, mixed>
     */
    private static function redact(array $data): array
    {
        foreach ($data as $key => $value) {
            if (in_array(mb_strtolower((string) $key), self::REDACTED_KEYS, true)) {
                $data[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $data[$key] = self::redact($value);
            }
        }

        return $data;
    }

    /**
     * The staff member who performed the action.
     *
     * @return BelongsTo<User, $this>
     */
    public function causer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'causer_id');
    }

    /**
     * The record the action was performed on.
     *
     * @return MorphTo<Model, $this>
     */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
```

- [ ] **Step 5: Migrate and run the test (PASS)** — `php artisan migrate`, then `php artisan test --compact tests/Feature/AuditLogTest.php` → PASS.

- [ ] **Step 6: Checkpoint commit** (Tasks 1–2)

```bash
vendor/bin/pint --dirty --format agent
git add -A
git commit -m "feat: add staff roles and audit log"
```

---

### Task 3: Login hardening, `/me`, and removing email verification

**Files:**

- Create: `app/Http/Resources/UserResource.php`, `app/Http/Controllers/CurrentUserController.php`, `app/Http/Middleware/EnsureUserIsActive.php`, `tests/Feature/Auth/StaffLoginTest.php`
- Modify: `app/Http/Requests/Auth/LoginRequest.php`, `app/Http/Controllers/Auth/AuthenticatedSessionController.php`, `app/Providers/AppServiceProvider.php`, `routes/api.php`, `routes/auth.php`, `bootstrap/app.php`, `tests/Feature/SanctumSpaTest.php`, `tests/Feature/SecurityHeadersTest.php`, `tests/Feature/Auth/AuthHardeningTest.php`
- Delete: `app/Http/Controllers/Auth/VerifyEmailController.php`, `app/Http/Controllers/Auth/EmailVerificationNotificationController.php`, `app/Http/Middleware/EnsureEmailIsVerified.php`, `tests/Feature/Auth/EmailVerificationTest.php`

**Interfaces:**

- Consumes: `AuditLog::record()` (Task 2), `User` helpers (Task 1).
- Produces: `GET /api/v1/me` (name `me.show`) → `{ data: UserResource, abilities: { manage_staff: bool } }`; middleware alias `active`; `UserResource` fields `id, name, email, role, role_label, is_active, must_change_password, last_login_at, created_at`.

- [ ] **Step 1: Write the failing test** — `tests/Feature/Auth/StaffLoginTest.php`

```php
<?php

use App\Models\AuditLog;
use App\Models\User;

test('deactivated staff cannot log in and see the same message as a wrong password', function () {
    $staff = User::factory()->inactive()->create();

    $this->postJson('/login', ['email' => $staff->email, 'password' => 'password'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email' => __('auth.failed')]);

    $this->assertGuest();
});

test('a successful login stamps the time and is audited', function () {
    $staff = User::factory()->create();

    $this->postJson('/login', ['email' => $staff->email, 'password' => 'password'])->assertNoContent();

    expect($staff->fresh()->last_login_at)->not->toBeNull();
    $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login', 'causer_id' => $staff->id]);
});

test('a failed login is audited with the email but never the password', function () {
    $this->postJson('/login', ['email' => 'someone@example.com', 'password' => 'wrong-password-123'])
        ->assertUnprocessable();

    $log = AuditLog::query()->where('action', 'auth.failed')->sole();

    expect($log->context)->toBe(['email' => 'someone@example.com'])
        ->and(json_encode($log->toArray()))->not->toContain('wrong-password-123');
});

test('the me endpoint returns the profile without secrets', function () {
    $staff = User::factory()->cashier()->create();

    $this->actingAs($staff)
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('data.email', $staff->email)
        ->assertJsonPath('data.role', 'cashier')
        ->assertJsonPath('data.role_label', 'Cashier')
        ->assertJsonPath('abilities.manage_staff', false)
        ->assertJsonMissingPath('data.password')
        ->assertJsonMissingPath('data.remember_token');
});

test('a deactivated staff member is signed out on their next request', function () {
    $staff = User::factory()->create();
    $this->actingAs($staff);
    $staff->forceFill(['is_active' => false])->save();

    $this->getJson('/api/v1/me')
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Your account has been deactivated.');

    $this->assertGuest('web');
});

test('email verification endpoints are gone', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/email/verification-notification')
        ->assertMethodNotAllowed();
});
```

- [ ] **Step 2: Run it (FAIL)** — `php artisan test --compact tests/Feature/Auth/StaffLoginTest.php`.

- [ ] **Step 3: Refuse deactivated accounts in `LoginRequest::authenticate()`**

Add `use App\Models\User;`, then replace the `Auth::attempt(...)` condition with `attemptWhen`. It fails exactly like a wrong password (same event, same message, same rate-limit hit):

```php
        if (! Auth::attemptWhen(
            $this->only('email', 'password'),
            fn (User $user): bool => $user->is_active,
            $this->boolean('remember'),
        )) {
```

- [ ] **Step 4: Stamp `last_login_at`** in `AuthenticatedSessionController::store()`, after `$request->session()->regenerate();`:

```php
        $request->user()?->forceFill(['last_login_at' => now()])->save();
```

- [ ] **Step 5: Create `app/Http/Resources/UserResource.php`**

```php
<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
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
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'is_active' => $this->is_active,
            'must_change_password' => $this->must_change_password,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
```

- [ ] **Step 6: Create `app/Http/Controllers/CurrentUserController.php`**

```php
<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;

class CurrentUserController extends Controller
{
    /**
     * Show the signed-in staff member and which admin areas the UI may offer them.
     */
    public function __invoke(#[CurrentUser] User $user): UserResource
    {
        return UserResource::make($user)->additional([
            'abilities' => [
                'manage_staff' => $user->can('viewAny', User::class),
            ],
        ]);
    }
}
```

- [ ] **Step 7: Create `app/Http/Middleware/EnsureUserIsActive.php`**

```php
<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    /**
     * Sign out a staff member whose account was deactivated while they were logged in.
     *
     * @param  Closure(Request): Response  $next
     *
     * @throws AuthenticationException
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && ! $user->is_active) {
            Auth::guard('web')->logout();

            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            throw new AuthenticationException('Your account has been deactivated.');
        }

        return $next($request);
    }
}
```

- [ ] **Step 8: Replace `routes/api.php`**

```php
<?php

use App\Http\Controllers\CurrentUserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/me', CurrentUserController::class)->name('me.show');
});
```

- [ ] **Step 9: Remove email verification**

Delete `app/Http/Controllers/Auth/VerifyEmailController.php`, `app/Http/Controllers/Auth/EmailVerificationNotificationController.php`, `app/Http/Middleware/EnsureEmailIsVerified.php` and `tests/Feature/Auth/EmailVerificationTest.php`.
In `routes/auth.php`, delete the two `use` lines for those controllers and the `verify-email/{id}/{hash}` and `email/verification-notification` routes.
In `bootstrap/app.php`, replace the `use App\Http\Middleware\EnsureEmailIsVerified;` import with `use App\Http\Middleware\EnsureUserIsActive;` and the alias block with:

```php
        $middleware->alias([
            'active' => EnsureUserIsActive::class,
        ]);
```

- [ ] **Step 10: Audit auth events** in `AppServiceProvider`

Add imports `App\Models\AuditLog`, `App\Models\User`, `Illuminate\Auth\Events\Failed`, `Illuminate\Auth\Events\Lockout`, `Illuminate\Auth\Events\Login`, `Illuminate\Auth\Events\Logout`, `Illuminate\Auth\Events\PasswordReset` and `Illuminate\Support\Facades\Event`. Call `$this->configureAuditTrail();` in `boot()`, and add:

```php
    /**
     * Write authentication events to the audit trail (never the password).
     */
    protected function configureAuditTrail(): void
    {
        Event::listen(function (Login $event): void {
            if ($event->user instanceof User) {
                AuditLog::record('auth.login', $event->user, $event->user);
            }
        });

        Event::listen(function (Failed $event): void {
            AuditLog::record('auth.failed', context: ['email' => $event->credentials['email'] ?? null]);
        });

        Event::listen(function (Logout $event): void {
            if ($event->user instanceof User) {
                AuditLog::record('auth.logout', $event->user, $event->user);
            }
        });

        Event::listen(function (Lockout $event): void {
            AuditLog::record('auth.lockout', context: ['email' => $event->request->input('email')]);
        });

        Event::listen(function (PasswordReset $event): void {
            if ($event->user instanceof User) {
                AuditLog::record('auth.password_reset', $event->user, $event->user);
            }
        });
    }
```

- [ ] **Step 11: Point the older tests at `/me`**

- `tests/Feature/SanctumSpaTest.php`: change every `/api/v1/user` to `/api/v1/me` and `assertJsonPath('email', …)` to `assertJsonPath('data.email', …)`. Add the test `'the pre-module-1 user endpoint is gone'`: `$this->actingAs(User::factory()->create())->getJson('/api/v1/user')->assertNotFound();`
- `tests/Feature/SecurityHeadersTest.php`: change `'/api/v1/user'` to `'/api/v1/me'` (dataset and JSON test).
- `tests/Feature/Auth/AuthHardeningTest.php`: change `'/api/v1/user'` to `'/api/v1/me'` in the rate-limit test.

- [ ] **Step 12: Run everything (PASS)** — `php artisan test --compact` → all PASS.

---

### Task 4: Authorization layers + staff list

**Files:**

- Create: `app/Policies/UserPolicy.php`, `app/Http/Middleware/EnsureUserHasRole.php`, `app/Http/Controllers/Admin/StaffController.php` (`index` only), `app/Http/Requests/Admin/ListStaffRequest.php`, `tests/Feature/Admin/StaffAuthorizationTest.php`
- Modify: `app/Providers/AppServiceProvider.php`, `bootstrap/app.php`, `routes/api.php`

**Interfaces:**

- Produces: `GET /api/v1/admin/staff` (`admin.staff.index`), filters `search` (≤100 chars), `role`, `per_page` (1–50), `page`, returning `{ data: UserResource[], links, meta }` ordered by name. Middleware alias `role` (`role:admin`). `UserPolicy::viewAny|create|update`. `Gate::before` → `true` for active admins.

- [ ] **Step 1: Write the failing test** — `tests/Feature/Admin/StaffAuthorizationTest.php`

```php
<?php

use App\Models\User;

test('admins can list staff', function () {
    $admin = User::factory()->admin()->create();
    User::factory()->cashier()->count(2)->create();

    $this->actingAs($admin)
        ->getJson('/api/v1/admin/staff')
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonStructure([
            'data' => [['id', 'name', 'email', 'role', 'is_active']],
            'meta' => ['current_page', 'last_page', 'total'],
        ]);
});

test('cashier and kitchen staff cannot list staff', function (string $role) {
    $this->actingAs(User::factory()->{$role}()->create())
        ->getJson('/api/v1/admin/staff')
        ->assertForbidden();
})->with(['cashier', 'kitchen']);

test('guests cannot list staff', function () {
    $this->getJson('/api/v1/admin/staff')->assertUnauthorized();
});

test('a deactivated admin loses admin powers', function () {
    $this->actingAs(User::factory()->admin()->inactive()->create())
        ->getJson('/api/v1/admin/staff')
        ->assertUnauthorized();
});

test('the staff list can be searched and filtered by role', function () {
    $admin = User::factory()->admin()->create(['name' => 'Ana Admin']);
    User::factory()->cashier()->create(['name' => 'Carlo Cashier']);
    User::factory()->kitchen()->create(['name' => 'Kiko Kitchen']);

    $this->actingAs($admin)->getJson('/api/v1/admin/staff?search=Carlo')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Carlo Cashier');

    $this->actingAs($admin)->getJson('/api/v1/admin/staff?role=kitchen')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Kiko Kitchen');
});

test('page size is capped', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/admin/staff?per_page=500')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('per_page');
});

test('the me endpoint tells admins they can manage staff', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/v1/me')
        ->assertJsonPath('abilities.manage_staff', true);
});
```

- [ ] **Step 2: Run it (FAIL)** — `php artisan test --compact tests/Feature/Admin/StaffAuthorizationTest.php`.

- [ ] **Step 3: Create `app/Policies/UserPolicy.php`** (auto-discovered for `User`)

```php
<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Determine whether the user can see the staff list.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->isAdmin();
    }

    /**
     * Determine whether the user can add staff.
     */
    public function create(User $actor): bool
    {
        return $actor->isAdmin();
    }

    /**
     * Determine whether the user can change a staff account (including its password).
     */
    public function update(User $actor, User $staff): bool
    {
        return $actor->isAdmin();
    }
}
```

- [ ] **Step 4: Create `app/Http/Middleware/EnsureUserHasRole.php`**

```php
<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Allow the request only when the signed-in user has one of the given roles.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        $allowedRoles = array_map(fn (string $role): Role => Role::from($role), $roles);

        if (! $user instanceof User || ! $user->hasRole(...$allowedRoles)) {
            abort(Response::HTTP_FORBIDDEN, 'You do not have access to this area.');
        }

        return $next($request);
    }
}
```

- [ ] **Step 5: `Gate::before` for active admins** in `AppServiceProvider`

Add `use Illuminate\Support\Facades\Gate;`, call `$this->configureAuthorization();` in `boot()`, and add:

```php
    /**
     * Active admins may do everything; everyone else goes through policies and gates.
     */
    protected function configureAuthorization(): void
    {
        Gate::before(fn (User $user): ?bool => $user->isAdmin() && $user->is_active ? true : null);
    }
```

- [ ] **Step 6: Create `app/Http/Requests/Admin/ListStaffRequest.php`**

```php
<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListStaffRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', User::class) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::enum(Role::class)],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
```

- [ ] **Step 7: Create `app/Http/Controllers/Admin/StaffController.php`** (`index` for now)

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListStaffRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StaffController extends Controller
{
    /**
     * List staff accounts, optionally searched by name/email and filtered by role.
     */
    public function index(ListStaffRequest $request): AnonymousResourceCollection
    {
        $search = $request->string('search')->trim()->toString();
        $role = $request->string('role')->toString();

        $query = User::query()->orderBy('name');

        if ($search !== '') {
            $query->whereAny(['name', 'email'], 'like', "%{$search}%");
        }

        if ($role !== '') {
            $query->where('role', $role);
        }

        return UserResource::collection(
            $query->paginate($request->integer('per_page', 20))->withQueryString(),
        );
    }
}
```

- [ ] **Step 8: Register the `role` alias and the admin route**

`bootstrap/app.php`: import `App\Http\Middleware\EnsureUserHasRole` and add `'role' => EnsureUserHasRole::class,` to the alias array.
`routes/api.php`:

```php
<?php

use App\Http\Controllers\Admin\StaffController;
use App\Http\Controllers\CurrentUserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/me', CurrentUserController::class)->name('me.show');

    Route::prefix('admin')->name('admin.')->middleware('role:admin')->group(function () {
        Route::get('/staff', [StaffController::class, 'index'])->name('staff.index');
    });
});
```

- [ ] **Step 9: Run it (PASS)** — `php artisan test --compact tests/Feature/Admin/StaffAuthorizationTest.php`, then the full suite.

- [ ] **Step 10: Checkpoint commit** (Tasks 3–4)

```bash
vendor/bin/pint --dirty --format agent
git add -A
git commit -m "feat: add /me, RBAC layers and staff list"
```

---

### Task 5: Staff management (add, edit, deactivate, reset password)

**Files:**

- Create: `app/Http/Requests/Admin/StoreStaffRequest.php`, `UpdateStaffRequest.php`, `ResetStaffPasswordRequest.php`, `app/Http/Controllers/Admin/StaffPasswordController.php`, `tests/Feature/Admin/StaffManagementTest.php`
- Modify: `app/Http/Controllers/Admin/StaffController.php` (`store`, `update`), `routes/api.php`

**Interfaces:**

- Produces: `POST /api/v1/admin/staff` (201, `{data: UserResource}`), `PATCH /api/v1/admin/staff/{user}` (200), `PUT /api/v1/admin/staff/{user}/password` (204). New staff and reset passwords set `must_change_password = true`. Audit actions `staff.created`, `staff.updated` (with diff), `staff.password_reset`.

- [ ] **Step 1: Write the failing test** — `tests/Feature/Admin/StaffManagementTest.php`

```php
<?php

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

test('an admin can add staff with a temporary password', function () {
    $this->actingAs($this->admin)->postJson('/api/v1/admin/staff', [
        'name' => 'Carlo Cruz',
        'email' => 'Carlo@Example.com',
        'role' => 'cashier',
        'password' => 'temporary-passphrase',
        'password_confirmation' => 'temporary-passphrase',
    ])
        ->assertCreated()
        ->assertJsonPath('data.email', 'carlo@example.com')
        ->assertJsonPath('data.role', 'cashier')
        ->assertJsonPath('data.must_change_password', true);

    $staff = User::query()->where('email', 'carlo@example.com')->sole();

    expect(Hash::check('temporary-passphrase', $staff->password))->toBeTrue();
    $this->assertDatabaseHas('audit_logs', [
        'action' => 'staff.created',
        'subject_id' => $staff->id,
        'causer_id' => $this->admin->id,
    ]);
});

test('new staff need a unique email, a known role and a strong password', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    $this->actingAs($this->admin)->postJson('/api/v1/admin/staff', [
        'name' => 'Someone',
        'email' => 'taken@example.com',
        'role' => 'owner',
        'password' => 'short',
        'password_confirmation' => 'short',
    ])->assertUnprocessable()->assertJsonValidationErrors(['email', 'role', 'password']);
});

test('an admin can change a role and deactivate an account', function () {
    $staff = User::factory()->cashier()->create();

    $this->actingAs($this->admin)
        ->patchJson("/api/v1/admin/staff/{$staff->id}", ['role' => 'kitchen', 'is_active' => false])
        ->assertOk()
        ->assertJsonPath('data.role', 'kitchen')
        ->assertJsonPath('data.is_active', false);

    $log = AuditLog::query()->where('action', 'staff.updated')->sole();

    expect($log->changes)->toMatchArray(['role' => ['from' => 'cashier', 'to' => 'kitchen']])
        ->and($log->changes)->toHaveKey('is_active');
});

test('an admin cannot demote or deactivate themselves', function () {
    $this->actingAs($this->admin)
        ->patchJson("/api/v1/admin/staff/{$this->admin->id}", ['role' => 'cashier', 'is_active' => false])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['role', 'is_active']);

    $fresh = $this->admin->fresh();

    expect($fresh->role)->toBe(Role::Admin)
        ->and($fresh->is_active)->toBeTrue();
});

test('non-admins cannot add staff or promote themselves', function () {
    $cashier = User::factory()->cashier()->create();

    $this->actingAs($cashier)->postJson('/api/v1/admin/staff', [
        'name' => 'Sneaky',
        'email' => 'sneaky@example.com',
        'role' => 'admin',
        'password' => 'temporary-passphrase',
        'password_confirmation' => 'temporary-passphrase',
    ])->assertForbidden();

    $this->actingAs($cashier)
        ->patchJson("/api/v1/admin/staff/{$cashier->id}", ['role' => 'admin'])
        ->assertForbidden();

    expect($cashier->fresh()->role)->toBe(Role::Cashier)
        ->and(User::query()->where('email', 'sneaky@example.com')->exists())->toBeFalse();
});

test('an admin can reset a staff password, which forces a change at next login', function () {
    $staff = User::factory()->create();

    $this->actingAs($this->admin)->putJson("/api/v1/admin/staff/{$staff->id}/password", [
        'password' => 'another-temporary-pass',
        'password_confirmation' => 'another-temporary-pass',
    ])->assertNoContent();

    $staff->refresh();

    expect(Hash::check('another-temporary-pass', $staff->password))->toBeTrue()
        ->and($staff->must_change_password)->toBeTrue();
    $this->assertDatabaseHas('audit_logs', ['action' => 'staff.password_reset', 'subject_id' => $staff->id]);
});

test('resetting a password signs the staff member out of existing sessions', function () {
    $staff = User::factory()->create();
    $oldSessionHash = auth()->guard('web')->hashPasswordForCookie($staff->password);

    $this->actingAs($this->admin)->putJson("/api/v1/admin/staff/{$staff->id}/password", [
        'password' => 'another-temporary-pass',
        'password_confirmation' => 'another-temporary-pass',
    ])->assertNoContent();

    $this->actingAs($staff->fresh())
        ->withSession(['password_hash_web' => $oldSessionHash])
        ->withHeader('Referer', config('app.url'))
        ->getJson('/api/v1/me')
        ->assertUnauthorized();
});

test('admins change their own password on the change-password page, not here', function () {
    $this->actingAs($this->admin)->putJson("/api/v1/admin/staff/{$this->admin->id}/password", [
        'password' => 'another-temporary-pass',
        'password_confirmation' => 'another-temporary-pass',
    ])->assertUnprocessable()->assertJsonValidationErrors('password');
});
```

- [ ] **Step 2: Run it (FAIL)** — `php artisan test --compact tests/Feature/Admin/StaffManagementTest.php`.

- [ ] **Step 3: Create `app/Http/Requests/Admin/StoreStaffRequest.php`**

```php
<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreStaffRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', User::class) ?? false;
    }

    /**
     * Normalize the email so the same address can't be added twice with different casing.
     */
    protected function prepareForValidation(): void
    {
        $email = $this->input('email');

        if (is_string($email)) {
            $this->merge(['email' => Str::lower(trim($email))]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique(User::class, 'email')],
            'role' => ['required', Rule::enum(Role::class)],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ];
    }
}
```

- [ ] **Step 4: Create `app/Http/Requests/Admin/UpdateStaffRequest.php`**

```php
<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateStaffRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $staff = $this->route('user');

        return $staff instanceof User && ($this->user()?->can('update', $staff) ?? false);
    }

    /**
     * Normalize the email so the same address can't be added twice with different casing.
     */
    protected function prepareForValidation(): void
    {
        $email = $this->input('email');

        if (is_string($email)) {
            $this->merge(['email' => Str::lower(trim($email))]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique(User::class, 'email')->ignore($this->route('user'))],
            'role' => ['sometimes', 'required', Rule::enum(Role::class)],
            'is_active' => ['sometimes', 'required', 'boolean'],
        ];
    }

    /**
     * An admin can never remove their own access, so at least one active admin always remains.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $staff = $this->route('user');

                if (! $staff instanceof User || $staff->isNot($this->user())) {
                    return;
                }

                if ($this->has('role') && $this->enum('role', Role::class) !== Role::Admin) {
                    $validator->errors()->add('role', 'You cannot remove your own admin role.');
                }

                if ($this->has('is_active') && ! $this->boolean('is_active')) {
                    $validator->errors()->add('is_active', 'You cannot deactivate your own account.');
                }
            },
        ];
    }
}
```

- [ ] **Step 5: Create `app/Http/Requests/Admin/ResetStaffPasswordRequest.php`**

```php
<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class ResetStaffPasswordRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $staff = $this->route('user');

        return $staff instanceof User && ($this->user()?->can('update', $staff) ?? false);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ];
    }

    /**
     * Your own password is changed with your current password, never through the admin reset.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $staff = $this->route('user');

                if ($staff instanceof User && $staff->is($this->user())) {
                    $validator->errors()->add('password', 'Use Change password to update your own password.');
                }
            },
        ];
    }
}
```

- [ ] **Step 6: Add `store` and `update` to `StaffController`**

New imports: `App\Enums\Role`, `App\Http\Requests\Admin\StoreStaffRequest`, `App\Http\Requests\Admin\UpdateStaffRequest`, `App\Models\AuditLog`, `Illuminate\Http\JsonResponse`, `Illuminate\Support\Facades\DB`.

```php
    /**
     * Add a staff member with an admin-set temporary password they must change at first login.
     */
    public function store(StoreStaffRequest $request): JsonResponse
    {
        $staff = DB::transaction(function () use ($request): User {
            $staff = new User($request->safe()->only(['name', 'email', 'password']));
            $staff->forceFill([
                'role' => $request->enum('role', Role::class),
                'is_active' => true,
                'must_change_password' => true,
            ])->save();

            AuditLog::record('staff.created', $staff, context: ['role' => $staff->role->value]);

            return $staff;
        });

        return UserResource::make($staff)->response()->setStatusCode(201);
    }

    /**
     * Change a staff member's details, role or active status.
     */
    public function update(UpdateStaffRequest $request, User $user): UserResource
    {
        DB::transaction(function () use ($request, $user): void {
            $user->fill($request->safe()->only(['name', 'email']));

            $role = $request->enum('role', Role::class);

            if ($role !== null) {
                $user->role = $role;
            }

            if ($request->has('is_active')) {
                $user->is_active = $request->boolean('is_active');
            }

            $user->save();

            if ($user->wasChanged()) {
                AuditLog::recordChange('staff.updated', $user);
            }
        });

        return UserResource::make($user);
    }
```

- [ ] **Step 7: Create `app/Http/Controllers/Admin/StaffPasswordController.php`**

A new password hash makes Sanctum's `AuthenticateSession` sign that person out of every existing session. The new `remember_token` kills "remember me" cookies.

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ResetStaffPasswordRequest;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class StaffPasswordController extends Controller
{
    /**
     * Give a staff member a new temporary password and sign them out everywhere.
     */
    public function __invoke(ResetStaffPasswordRequest $request, User $user): Response
    {
        $user->forceFill([
            'password' => $request->validated('password'),
            'must_change_password' => true,
            'remember_token' => Str::random(60),
        ])->save();

        AuditLog::record('staff.password_reset', $user);

        return response()->noContent();
    }
}
```

- [ ] **Step 8: Add the routes** — in `routes/api.php`, import `App\Http\Controllers\Admin\StaffPasswordController` and extend the admin group:

```php
    Route::prefix('admin')->name('admin.')->middleware('role:admin')->group(function () {
        Route::get('/staff', [StaffController::class, 'index'])->name('staff.index');
        Route::post('/staff', [StaffController::class, 'store'])->name('staff.store');
        Route::patch('/staff/{user}', [StaffController::class, 'update'])->name('staff.update');
        Route::put('/staff/{user}/password', StaffPasswordController::class)->name('staff.password.update');
    });
```

- [ ] **Step 9: Run it (PASS)** — `php artisan test --compact tests/Feature/Admin`, then the full suite.

---

### Task 6: Change your own password + the temporary-password gate

**Files:**

- Create: `app/Http/Requests/UpdateCurrentUserPasswordRequest.php`, `app/Http/Controllers/CurrentUserPasswordController.php`, `app/Http/Middleware/EnsurePasswordIsChanged.php`, `tests/Feature/Auth/PasswordChangeTest.php`
- Modify: `routes/api.php`, `bootstrap/app.php`

**Interfaces:**

- Produces: `PUT /api/v1/me/password` (`me.password.update`, 204, `throttle:6,1`); middleware alias `password.changed`, which returns 403 `{message, code: "password_change_required"}`. Only `/me` and `/me/password` skip it.

- [ ] **Step 1: Write the failing test** — `tests/Feature/Auth/PasswordChangeTest.php`

```php
<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('staff with a temporary password are blocked from everything but changing it', function () {
    $admin = User::factory()->admin()->mustChangePassword()->create();

    $this->actingAs($admin)->getJson('/api/v1/admin/staff')
        ->assertForbidden()
        ->assertJsonPath('code', 'password_change_required');

    $this->actingAs($admin)->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('data.must_change_password', true);
});

test('changing the password requires the current one', function () {
    $this->actingAs(User::factory()->create())->putJson('/api/v1/me/password', [
        'current_password' => 'not-my-password',
        'password' => 'a-brand-new-passphrase',
        'password_confirmation' => 'a-brand-new-passphrase',
    ])->assertUnprocessable()->assertJsonValidationErrors('current_password');
});

test('the new password must be strong and different', function () {
    $this->actingAs(User::factory()->create())->putJson('/api/v1/me/password', [
        'current_password' => 'password',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertUnprocessable()->assertJsonValidationErrors('password');
});

test('changing the password clears the temporary flag and is audited', function () {
    $staff = User::factory()->mustChangePassword()->create();

    $this->actingAs($staff)->putJson('/api/v1/me/password', [
        'current_password' => 'password',
        'password' => 'a-brand-new-passphrase',
        'password_confirmation' => 'a-brand-new-passphrase',
    ])->assertNoContent();

    $staff->refresh();

    expect($staff->must_change_password)->toBeFalse()
        ->and(Hash::check('a-brand-new-passphrase', $staff->password))->toBeTrue();
    $this->assertDatabaseHas('audit_logs', ['action' => 'auth.password_changed', 'causer_id' => $staff->id]);
});

test('password change attempts are rate limited', function () {
    $staff = User::factory()->create();
    $attempt = [
        'current_password' => 'wrong-password',
        'password' => 'a-brand-new-passphrase',
        'password_confirmation' => 'a-brand-new-passphrase',
    ];

    foreach (range(1, 6) as $try) {
        $this->actingAs($staff)->putJson('/api/v1/me/password', $attempt)->assertUnprocessable();
    }

    $this->actingAs($staff)->putJson('/api/v1/me/password', $attempt)->assertTooManyRequests();
});
```

- [ ] **Step 2: Run it (FAIL)** — `php artisan test --compact tests/Feature/Auth/PasswordChangeTest.php`.

- [ ] **Step 3: Create `app/Http/Requests/UpdateCurrentUserPasswordRequest.php`**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdateCurrentUserPasswordRequest extends FormRequest
{
    /**
     * Any signed-in staff member may change their own password.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string', 'current_password'],
            'password' => ['required', 'string', 'confirmed', 'different:current_password', Password::defaults()],
        ];
    }
}
```

- [ ] **Step 4: Create `app/Http/Controllers/CurrentUserPasswordController.php`**

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateCurrentUserPasswordRequest;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Response;

class CurrentUserPasswordController extends Controller
{
    /**
     * Replace the signed-in user's password; other sessions are signed out by Sanctum.
     */
    public function __invoke(UpdateCurrentUserPasswordRequest $request, #[CurrentUser] User $user): Response
    {
        $user->forceFill([
            'password' => $request->validated('password'),
            'must_change_password' => false,
        ])->save();

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        AuditLog::record('auth.password_changed', $user, $user);

        return response()->noContent();
    }
}
```

- [ ] **Step 5: Create `app/Http/Middleware/EnsurePasswordIsChanged.php`**

```php
<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordIsChanged
{
    /**
     * Block staff who still use an admin-set temporary password.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->must_change_password) {
            return response()->json([
                'message' => 'You must change your temporary password before continuing.',
                'code' => 'password_change_required',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
```

- [ ] **Step 6: Wire the alias and routes**

`bootstrap/app.php`: import `App\Http\Middleware\EnsurePasswordIsChanged` and add `'password.changed' => EnsurePasswordIsChanged::class,` to the aliases.
Replace `routes/api.php` with the final version:

```php
<?php

use App\Http\Controllers\Admin\StaffController;
use App\Http\Controllers\Admin\StaffPasswordController;
use App\Http\Controllers\CurrentUserController;
use App\Http\Controllers\CurrentUserPasswordController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/me', CurrentUserController::class)->name('me.show');
    Route::put('/me/password', CurrentUserPasswordController::class)
        ->middleware('throttle:6,1')
        ->name('me.password.update');

    Route::middleware('password.changed')->group(function () {
        Route::prefix('admin')->name('admin.')->middleware('role:admin')->group(function () {
            Route::get('/staff', [StaffController::class, 'index'])->name('staff.index');
            Route::post('/staff', [StaffController::class, 'store'])->name('staff.store');
            Route::patch('/staff/{user}', [StaffController::class, 'update'])->name('staff.update');
            Route::put('/staff/{user}/password', StaffPasswordController::class)->name('staff.password.update');
        });
    });
});
```

- [ ] **Step 7: Run it (PASS)** — `php artisan test --compact tests/Feature/Auth/PasswordChangeTest.php`, then the full suite.

---

### Task 7: First admin from the console + safe seeding

**Files:**

- Create: `app/Console/Commands/CreateAdminCommand.php`, `tests/Feature/Console/CreateAdminCommandTest.php`
- Modify: `database/seeders/DatabaseSeeder.php`

**Interfaces:**

- Produces: `php artisan app:create-admin`, which prompts for Name, Email, Password and Confirm password (never a CLI argument, so it stays out of shell history) and creates an active Admin with `must_change_password = false`, audited as `staff.created` with `via: console`.

- [ ] **Step 1: Write the failing test** — `tests/Feature/Console/CreateAdminCommandTest.php`

```php
<?php

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('the first admin can be created from the console', function () {
    $this->artisan('app:create-admin')
        ->expectsQuestion('Name', 'Maria Santos')
        ->expectsQuestion('Email', 'Maria@BarrioBistro.test')
        ->expectsQuestion('Password', 'a-strong-admin-passphrase')
        ->expectsQuestion('Confirm password', 'a-strong-admin-passphrase')
        ->expectsOutputToContain('Admin account created')
        ->assertSuccessful();

    $admin = User::query()->where('email', 'maria@barriobistro.test')->sole();

    expect($admin->role)->toBe(Role::Admin)
        ->and($admin->is_active)->toBeTrue()
        ->and($admin->must_change_password)->toBeFalse()
        ->and(Hash::check('a-strong-admin-passphrase', $admin->password))->toBeTrue();
    $this->assertDatabaseHas('audit_logs', ['action' => 'staff.created', 'subject_id' => $admin->id]);
});

test('mismatched passwords create nothing', function () {
    $this->artisan('app:create-admin')
        ->expectsQuestion('Name', 'Maria Santos')
        ->expectsQuestion('Email', 'maria@barriobistro.test')
        ->expectsQuestion('Password', 'a-strong-admin-passphrase')
        ->expectsQuestion('Confirm password', 'something-else-entirely')
        ->expectsOutputToContain('Passwords do not match')
        ->assertFailed();

    expect(User::query()->count())->toBe(0);
});

test('a weak password creates nothing', function () {
    $this->artisan('app:create-admin')
        ->expectsQuestion('Name', 'Maria Santos')
        ->expectsQuestion('Email', 'maria@barriobistro.test')
        ->expectsQuestion('Password', 'short')
        ->expectsQuestion('Confirm password', 'short')
        ->assertFailed();

    expect(User::query()->count())->toBe(0);
});
```

- [ ] **Step 2: Run it (FAIL)** — `php artisan test --compact tests/Feature/Console/CreateAdminCommandTest.php`.

- [ ] **Step 3: Create `app/Console/Commands/CreateAdminCommand.php`**

```php
<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

#[Signature('app:create-admin')]
#[Description('Create an admin account (the password is prompted, never passed as an argument)')]
class CreateAdminCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $name = text(label: 'Name', required: true);
        $email = Str::lower(trim(text(label: 'Email', required: true)));
        $password = password(label: 'Password', required: true);
        $confirmation = password(label: 'Confirm password', required: true);

        if ($password !== $confirmation) {
            $this->components->error('Passwords do not match. Nothing was created.');

            return self::FAILURE;
        }

        $validator = Validator::make(
            ['name' => $name, 'email' => $email, 'password' => $password],
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'string', 'email', 'max:255', Rule::unique(User::class, 'email')],
                'password' => ['required', 'string', Password::defaults()],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->components->error($error);
            }

            return self::FAILURE;
        }

        $admin = DB::transaction(function () use ($name, $email, $password): User {
            $admin = new User(['name' => $name, 'email' => $email, 'password' => $password]);
            $admin->forceFill([
                'role' => Role::Admin,
                'is_active' => true,
                'must_change_password' => false,
                'email_verified_at' => now(),
            ])->save();

            AuditLog::record('staff.created', $admin, context: ['role' => Role::Admin->value, 'via' => 'console']);

            return $admin;
        });

        $this->components->info("Admin account created for {$admin->email}.");

        return self::SUCCESS;
    }
}
```

- [ ] **Step 4: Replace `database/seeders/DatabaseSeeder.php`** (no default admin, and demo staff only locally)

```php
<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed demo staff for local development only.
     *
     * The first admin is created with `php artisan app:create-admin`, so no
     * account with a known password is ever seeded into a real environment.
     */
    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        User::factory()->cashier()->count(3)->create();
        User::factory()->kitchen()->count(2)->create();
    }
}
```

- [ ] **Step 5: Run it (PASS)** — `php artisan test --compact tests/Feature/Console/CreateAdminCommandTest.php`, then the full suite and `vendor/bin/phpstan analyse`.

- [ ] **Step 6: Create your real admin locally** — `php artisan app:create-admin` (use your own email and a 12+ character password), then `php artisan db:seed` for the demo staff.

- [ ] **Step 7: Checkpoint commit** (Tasks 5–7)

```bash
vendor/bin/pint --dirty --format agent
git add -A
git commit -m "feat: staff management API, password change gate, create-admin command"
```

---

### Task 8: Frontend auth — API client, login, change password

**Files:**

- Create: `resources/js/lib/http.ts`, `resources/js/lib/auth.ts`, `resources/js/components/form-field.tsx`, `resources/js/pages/auth/login.tsx`, `resources/js/pages/account/change-password.tsx`, `resources/js/pages/route-error.tsx`
- Replace: `resources/js/types/auth.ts`
- Modify: `resources/views/app.blade.php`, `resources/js/app.tsx`, `resources/js/router.tsx`
- shadcn: `input`, `label`, `alert` (+ `table`, `dialog`, `select`, `switch` for Task 9)

**Interfaces:**

- Produces: `http.get/post/put/patch<T>()` and `HttpError { status, body, errors }`; `fetchCurrentUser()`, `login()`, `logout()`, `changePassword()`; loaders `guestLoader`, `authLoader`, `staffLoader`; types `Role`, `StaffUser`, `Abilities`, `CurrentUser`, `Paginated<T>`; `<FormField id label error ...inputProps />`.

- [ ] **Step 1: Add the shadcn components, then keep our own `cn`**

```bash
npx shadcn@latest add input label alert table dialog select switch
```

The CLI rewrites imports to the `cn` package again. Claude points them back at `@/lib/utils` in `resources/js/components/ui/*.tsx`, then you run:

```bash
npm uninstall cn
npm install get-nonce
npm ls get-nonce
```

`npm ls get-nonce` must show **one** version (deduped under `react-style-singleton`). Radix injects a `<style>` tag for dialogs and selects, and it reads the CSP nonce from `get-nonce`. Without this, production CSP would block the dialogs.

- [ ] **Step 2: Expose the CSP nonce** — in `resources/views/app.blade.php`, add inside `<head>` right after the viewport meta:

```blade
        <meta name="csp-nonce" content="{{ Vite::cspNonce() }}">
```

and in `resources/js/app.tsx`, add at the top (after the imports):

```tsx
import { setNonce } from 'get-nonce';

const cspNonce = document.querySelector<HTMLMetaElement>(
    'meta[name="csp-nonce"]',
)?.content;

if (cspNonce) {
    setNonce(cspNonce);
}
```

- [ ] **Step 3: Replace `resources/js/types/auth.ts`**

```ts
export type Role = 'admin' | 'cashier' | 'kitchen';

export type StaffUser = {
    id: number;
    name: string;
    email: string;
    role: Role;
    role_label: string;
    is_active: boolean;
    must_change_password: boolean;
    last_login_at: string | null;
    created_at: string;
};

export type Abilities = {
    manage_staff: boolean;
};

export type CurrentUser = {
    user: StaffUser;
    abilities: Abilities;
};

export type Paginated<T> = {
    data: T[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
};
```

- [ ] **Step 4: Create `resources/js/lib/http.ts`**

```ts
export type ValidationErrors = Record<string, string[]>;

export type ApiErrorBody = {
    message?: string;
    code?: string;
    errors?: ValidationErrors;
};

export class HttpError extends Error {
    readonly status: number;

    readonly body: ApiErrorBody;

    constructor(status: number, body: ApiErrorBody) {
        super(body.message ?? `Request failed with status ${status}`);
        this.name = 'HttpError';
        this.status = status;
        this.body = body;
    }

    get errors(): ValidationErrors {
        return this.body.errors ?? {};
    }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH';

function readCookie(name: string): string | null {
    const prefix = `${name}=`;
    const cookie = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(prefix));

    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

let csrfCookieRequest: Promise<void> | null = null;

function ensureCsrfCookie(forceRefresh = false): Promise<void> {
    if (
        forceRefresh ||
        csrfCookieRequest === null ||
        readCookie('XSRF-TOKEN') === null
    ) {
        csrfCookieRequest = fetch('/sanctum/csrf-cookie', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        }).then(() => undefined);
    }

    return csrfCookieRequest;
}

async function send<T>(
    method: Method,
    url: string,
    body?: unknown,
    isRetry = false,
): Promise<T> {
    const isMutation = method !== 'GET';

    if (isMutation) {
        await ensureCsrfCookie();
    }

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const xsrfToken = readCookie('XSRF-TOKEN');

    if (isMutation && xsrfToken !== null) {
        headers['X-XSRF-TOKEN'] = xsrfToken;
    }

    const response = await fetch(url, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 419 && !isRetry) {
        await ensureCsrfCookie(true);

        return send<T>(method, url, body, true);
    }

    if (!response.ok) {
        const errorBody = (await response
            .json()
            .catch(() => ({}))) as ApiErrorBody;

        throw new HttpError(response.status, errorBody);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
}

export const http = {
    get: <T>(url: string) => send<T>('GET', url),
    post: <T>(url: string, body?: unknown) => send<T>('POST', url, body),
    put: <T>(url: string, body?: unknown) => send<T>('PUT', url, body),
    patch: <T>(url: string, body?: unknown) => send<T>('PATCH', url, body),
};
```

- [ ] **Step 5: Create `resources/js/lib/auth.ts`**

```ts
import { redirect } from 'react-router';
import { HttpError, http } from '@/lib/http';
import type { Abilities, CurrentUser, StaffUser } from '@/types';

type CurrentUserResponse = {
    data: StaffUser;
    abilities: Abilities;
};

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
    try {
        const response = await http.get<CurrentUserResponse>('/api/v1/me');

        return { user: response.data, abilities: response.abilities };
    } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
            return null;
        }

        throw error;
    }
}

export function login(email: string, password: string): Promise<void> {
    return http.post<void>('/login', { email, password });
}

export function logout(): Promise<void> {
    return http.post<void>('/logout');
}

export function changePassword(payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
}): Promise<void> {
    return http.put<void>('/api/v1/me/password', payload);
}

/** Loader: the login page is only for guests. */
export async function guestLoader(): Promise<null> {
    const current = await fetchCurrentUser();

    if (current !== null) {
        throw redirect(
            current.user.must_change_password ? '/account/password' : '/admin',
        );
    }

    return null;
}

/** Loader: any signed-in staff member. */
export async function authLoader(): Promise<CurrentUser> {
    const current = await fetchCurrentUser();

    if (current === null) {
        throw redirect('/login');
    }

    return current;
}

/** Loader: signed-in staff who have replaced their temporary password. */
export async function staffLoader(): Promise<CurrentUser> {
    const current = await authLoader();

    if (current.user.must_change_password) {
        throw redirect('/account/password');
    }

    return current;
}
```

- [ ] **Step 6: Create `resources/js/components/form-field.tsx`**

```tsx
import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FormFieldProps = ComponentProps<typeof Input> & {
    id: string;
    label: string;
    error?: string;
};

export function FormField({ id, label, error, ...inputProps }: FormFieldProps) {
    const errorId = `${id}-error`;

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                {...inputProps}
            />
            {error && (
                <p id={errorId} className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
```

- [ ] **Step 7: Create `resources/js/pages/auth/login.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { login } from '@/lib/auth';
import { HttpError, type ValidationErrors } from '@/lib/http';

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setErrors({});
        setFormError(null);

        try {
            await login(email, password);
            await navigate('/admin');
        } catch (error) {
            if (error instanceof HttpError && error.status === 422) {
                setErrors(error.errors);
            } else if (error instanceof HttpError && error.status === 429) {
                setFormError('Too many attempts. Wait a minute and try again.');
            } else {
                setFormError('Could not reach the server. Try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-dahon p-6">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="font-display text-2xl font-extrabold">
                        Staff login
                    </CardTitle>
                    <CardDescription>
                        For Barrio Bistro staff only.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(event) => void handleSubmit(event)}
                        className="grid gap-4"
                    >
                        {formError && (
                            <Alert variant="destructive">
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        )}
                        <FormField
                            id="email"
                            label="Email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            error={errors.email?.[0]}
                            maxLength={255}
                            required
                            autoFocus
                        />
                        <FormField
                            id="password"
                            label="Password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            error={errors.password?.[0]}
                            maxLength={255}
                            required
                        />
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Logging in…' : 'Log in'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
```

- [ ] **Step 8: Create `resources/js/pages/account/change-password.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { changePassword, type authLoader } from '@/lib/auth';
import { HttpError, type ValidationErrors } from '@/lib/http';

export default function ChangePassword() {
    const { user } = useLoaderData<typeof authLoader>();
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSaving(true);
        setErrors({});
        setFormError(null);

        try {
            await changePassword({
                current_password: currentPassword,
                password,
                password_confirmation: passwordConfirmation,
            });
            await navigate('/admin');
        } catch (error) {
            if (error instanceof HttpError && error.status === 422) {
                setErrors(error.errors);
            } else if (error instanceof HttpError && error.status === 429) {
                setFormError('Too many attempts. Wait a minute and try again.');
            } else {
                setFormError('Could not reach the server. Try again.');
            }
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-background p-6">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="font-display text-2xl font-extrabold">
                        {user.must_change_password
                            ? 'Set your own password'
                            : 'Change password'}
                    </CardTitle>
                    <CardDescription>
                        {user.must_change_password
                            ? 'You signed in with a temporary password. Choose a new one that only you know.'
                            : 'Use at least 12 characters.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(event) => void handleSubmit(event)}
                        className="grid gap-4"
                    >
                        {formError && (
                            <Alert variant="destructive">
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        )}
                        <FormField
                            id="current-password"
                            label="Current password"
                            type="password"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(event) =>
                                setCurrentPassword(event.target.value)
                            }
                            error={errors.current_password?.[0]}
                            required
                        />
                        <FormField
                            id="new-password"
                            label="New password"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            error={errors.password?.[0]}
                            minLength={12}
                            required
                        />
                        <FormField
                            id="new-password-confirmation"
                            label="Confirm new password"
                            type="password"
                            autoComplete="new-password"
                            value={passwordConfirmation}
                            onChange={(event) =>
                                setPasswordConfirmation(event.target.value)
                            }
                            minLength={12}
                            required
                        />
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving…' : 'Save password'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
```

- [ ] **Step 9: Create `resources/js/pages/route-error.tsx`**

```tsx
import { Link, Navigate, useRouteError } from 'react-router';
import { HttpError } from '@/lib/http';

export default function RouteError() {
    const error = useRouteError();

    if (error instanceof HttpError && error.status === 401) {
        return <Navigate to="/login" replace />;
    }

    if (
        error instanceof HttpError &&
        error.body.code === 'password_change_required'
    ) {
        return <Navigate to="/account/password" replace />;
    }

    const message =
        error instanceof HttpError && error.status === 403
            ? 'You do not have access to this page.'
            : 'Something went wrong. Please try again.';

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
            <h1 className="text-2xl font-semibold">{message}</h1>
            <Link to="/admin" className="underline">
                Back to the dashboard
            </Link>
        </main>
    );
}
```

- [ ] **Step 10: Temporary router wiring** (Task 9 adds the admin area). In `resources/js/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router';
import { authLoader, guestLoader } from '@/lib/auth';
import ChangePassword from '@/pages/account/change-password';
import Login from '@/pages/auth/login';
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';
import RouteError from '@/pages/route-error';

export const router = createBrowserRouter([
    { path: '/', element: <Home /> },
    { path: '/login', element: <Login />, loader: guestLoader },
    {
        path: '/account/password',
        element: <ChangePassword />,
        loader: authLoader,
        errorElement: <RouteError />,
    },
    { path: '*', element: <NotFound /> },
]);
```

- [ ] **Step 11: Verify** — `npm run types:check`, `npm run build`, `npm run check` (use `npm run check:fix` for formatting). Then, with `composer run dev`, log in at `http://localhost:8000/login` using a **demo staff** account from the seeder. It should land on `/admin`, which is the not-found page until Task 9. Log in with a wrong password: you should see "These credentials do not match our records."

---

### Task 9: Admin layout + staff management screen

**Files:**

- Create: `resources/js/layouts/admin-layout.tsx`, `resources/js/pages/admin/dashboard.tsx`, `resources/js/pages/admin/staff.tsx`, `resources/js/lib/staff.ts`, `resources/js/components/staff/staff-form-dialog.tsx`, `resources/js/components/staff/reset-password-dialog.tsx`
- Modify: `resources/js/router.tsx`

**Interfaces:**

- Consumes: `http`, `HttpError` (Task 8), `staffLoader` (Task 8), and the staff API (Task 5).
- Produces: `/admin` (route id `admin`) and `/admin/staff`; `listStaff`, `createStaff`, `updateStaff`, `resetStaffPassword`, `staffPageLoader`.

- [ ] **Step 1: Create `resources/js/lib/staff.ts`**

```ts
import type { LoaderFunctionArgs } from 'react-router';
import { http } from '@/lib/http';
import type { Paginated, Role, StaffUser } from '@/types';

export type NewStaff = {
    name: string;
    email: string;
    role: Role;
    password: string;
    password_confirmation: string;
};

export type StaffChanges = Partial<{
    name: string;
    email: string;
    role: Role;
    is_active: boolean;
}>;

export function listStaff(
    query: URLSearchParams,
): Promise<Paginated<StaffUser>> {
    return http.get<Paginated<StaffUser>>(
        `/api/v1/admin/staff?${query.toString()}`,
    );
}

export function createStaff(payload: NewStaff): Promise<{ data: StaffUser }> {
    return http.post<{ data: StaffUser }>('/api/v1/admin/staff', payload);
}

export function updateStaff(
    id: number,
    changes: StaffChanges,
): Promise<{ data: StaffUser }> {
    return http.patch<{ data: StaffUser }>(
        `/api/v1/admin/staff/${id}`,
        changes,
    );
}

export function resetStaffPassword(
    id: number,
    payload: { password: string; password_confirmation: string },
): Promise<void> {
    return http.put<void>(`/api/v1/admin/staff/${id}/password`, payload);
}

/** Loader: the staff list for the page and search in the URL. */
export function staffPageLoader({
    request,
}: LoaderFunctionArgs): Promise<Paginated<StaffUser>> {
    const { searchParams } = new URL(request.url);
    const query = new URLSearchParams();

    for (const key of ['page', 'search']) {
        const value = searchParams.get(key);

        if (value) {
            query.set(key, value);
        }
    }

    return listStaff(query);
}
```

- [ ] **Step 2: Create `resources/js/layouts/admin-layout.tsx`**

```tsx
import {
    Link,
    NavLink,
    Outlet,
    useLoaderData,
    useNavigate,
} from 'react-router';
import { Button } from '@/components/ui/button';
import { logout, type staffLoader } from '@/lib/auth';
import { cn } from '@/lib/utils';

export default function AdminLayout() {
    const { user, abilities } = useLoaderData<typeof staffLoader>();
    const navigate = useNavigate();

    const links = [
        { to: '/admin', label: 'Dashboard', end: true, visible: true },
        {
            to: '/admin/staff',
            label: 'Staff',
            end: false,
            visible: abilities.manage_staff,
        },
    ].filter((link) => link.visible);

    async function handleLogout() {
        await logout();
        await navigate('/login');
    }

    return (
        <div className="flex min-h-screen flex-col bg-background md:flex-row">
            <aside className="flex shrink-0 flex-col gap-6 border-b bg-card p-4 md:w-60 md:border-r md:border-b-0">
                <Link
                    to="/admin"
                    className="font-display text-xl font-extrabold text-dahon"
                >
                    Barrio Bistro
                </Link>
                <nav className="flex gap-1 md:flex-col" aria-label="Admin">
                    {links.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            className={({ isActive }) =>
                                cn(
                                    'rounded-md px-3 py-2 text-sm font-medium hover:bg-muted',
                                    isActive && 'bg-muted text-dahon',
                                )
                            }
                        >
                            {link.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="flex flex-col gap-2 text-sm md:mt-auto">
                    <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-muted-foreground">
                            {user.role_label}
                        </p>
                    </div>
                    <Link to="/account/password" className="underline">
                        Change password
                    </Link>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleLogout()}
                    >
                        Log out
                    </Button>
                </div>
            </aside>
            <main className="flex-1 p-6">
                <Outlet />
            </main>
        </div>
    );
}
```

- [ ] **Step 3: Create `resources/js/pages/admin/dashboard.tsx`**

```tsx
import { useRouteLoaderData } from 'react-router';
import type { staffLoader } from '@/lib/auth';

export default function Dashboard() {
    const current = useRouteLoaderData<typeof staffLoader>('admin');

    return (
        <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-extrabold">
                Magandang araw, {current?.user.name}!
            </h1>
            <p className="text-muted-foreground">
                Orders and reports will appear here in the next modules.
            </p>
        </div>
    );
}
```

- [ ] **Step 4: Create `resources/js/components/staff/staff-form-dialog.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { HttpError, type ValidationErrors } from '@/lib/http';
import { createStaff, updateStaff } from '@/lib/staff';
import type { Role, StaffUser } from '@/types';

const roleOptions: { value: Role; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'kitchen', label: 'Kitchen' },
];

function isRole(value: string): value is Role {
    return roleOptions.some((option) => option.value === value);
}

type StaffFormDialogProps = {
    staff: StaffUser | null;
    isSelf: boolean;
    onClose: () => void;
    onSaved: () => void;
};

export function StaffFormDialog({
    staff,
    isSelf,
    onClose,
    onSaved,
}: StaffFormDialogProps) {
    const [name, setName] = useState(staff?.name ?? '');
    const [email, setEmail] = useState(staff?.email ?? '');
    const [role, setRole] = useState<Role>(staff?.role ?? 'kitchen');
    const [isActive, setIsActive] = useState(staff?.is_active ?? true);
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSaving(true);
        setErrors({});
        setFormError(null);

        try {
            if (staff === null) {
                await createStaff({
                    name,
                    email,
                    role,
                    password,
                    password_confirmation: passwordConfirmation,
                });
            } else {
                await updateStaff(staff.id, {
                    name,
                    email,
                    role,
                    is_active: isActive,
                });
            }

            onSaved();
            onClose();
        } catch (error) {
            if (error instanceof HttpError && error.status === 422) {
                setErrors(error.errors);
            } else {
                setFormError(
                    error instanceof HttpError
                        ? error.message
                        : 'Could not reach the server. Try again.',
                );
            }
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent>
                <form
                    onSubmit={(event) => void handleSubmit(event)}
                    className="grid gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>
                            {staff === null
                                ? 'Add staff'
                                : `Edit ${staff.name}`}
                        </DialogTitle>
                        <DialogDescription>
                            {staff === null
                                ? 'They must change this temporary password when they first log in. Hand it over in person.'
                                : 'Changes apply on their next request.'}
                        </DialogDescription>
                    </DialogHeader>

                    {formError && (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}

                    <FormField
                        id="staff-name"
                        label="Name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        error={errors.name?.[0]}
                        maxLength={255}
                        autoComplete="off"
                        required
                    />
                    <FormField
                        id="staff-email"
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        error={errors.email?.[0]}
                        maxLength={255}
                        autoComplete="off"
                        required
                    />

                    <div className="grid gap-2">
                        <Label htmlFor="staff-role">Role</Label>
                        <Select
                            value={role}
                            onValueChange={(value) => {
                                if (isRole(value)) {
                                    setRole(value);
                                }
                            }}
                            disabled={isSelf}
                        >
                            <SelectTrigger
                                id="staff-role"
                                aria-invalid={errors.role ? true : undefined}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {roleOptions.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.role && (
                            <p className="text-sm text-destructive">
                                {errors.role[0]}
                            </p>
                        )}
                    </div>

                    {staff === null ? (
                        <>
                            <FormField
                                id="staff-password"
                                label="Temporary password"
                                type="password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                error={errors.password?.[0]}
                                autoComplete="new-password"
                                minLength={12}
                                required
                            />
                            <FormField
                                id="staff-password-confirmation"
                                label="Confirm temporary password"
                                type="password"
                                value={passwordConfirmation}
                                onChange={(event) =>
                                    setPasswordConfirmation(event.target.value)
                                }
                                autoComplete="new-password"
                                minLength={12}
                                required
                            />
                        </>
                    ) : (
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                                <Label htmlFor="staff-active">
                                    Active account
                                </Label>
                                <Switch
                                    id="staff-active"
                                    checked={isActive}
                                    onCheckedChange={setIsActive}
                                    disabled={isSelf}
                                />
                            </div>
                            {errors.is_active && (
                                <p className="text-sm text-destructive">
                                    {errors.is_active[0]}
                                </p>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 5: Create `resources/js/components/staff/reset-password-dialog.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { HttpError, type ValidationErrors } from '@/lib/http';
import { resetStaffPassword } from '@/lib/staff';
import type { StaffUser } from '@/types';

type ResetPasswordDialogProps = {
    staff: StaffUser;
    onClose: () => void;
};

export function ResetPasswordDialog({
    staff,
    onClose,
}: ResetPasswordDialogProps) {
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDone, setIsDone] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSaving(true);
        setErrors({});
        setFormError(null);

        try {
            await resetStaffPassword(staff.id, {
                password,
                password_confirmation: passwordConfirmation,
            });
            setIsDone(true);
        } catch (error) {
            if (error instanceof HttpError && error.status === 422) {
                setErrors(error.errors);
            } else {
                setFormError(
                    error instanceof HttpError
                        ? error.message
                        : 'Could not reach the server. Try again.',
                );
            }
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reset password for {staff.name}</DialogTitle>
                    <DialogDescription>
                        They will be signed out everywhere and must choose a new
                        password at their next login.
                    </DialogDescription>
                </DialogHeader>

                {isDone ? (
                    <div className="grid gap-4">
                        <Alert>
                            <AlertDescription>
                                Password reset. Give the temporary password to{' '}
                                {staff.name} in person, not by chat.
                            </AlertDescription>
                        </Alert>
                        <DialogFooter>
                            <Button onClick={onClose}>Done</Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form
                        onSubmit={(event) => void handleSubmit(event)}
                        className="grid gap-4"
                    >
                        {formError && (
                            <Alert variant="destructive">
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        )}
                        <FormField
                            id="reset-password"
                            label="New temporary password"
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            error={errors.password?.[0]}
                            autoComplete="new-password"
                            minLength={12}
                            required
                        />
                        <FormField
                            id="reset-password-confirmation"
                            label="Confirm temporary password"
                            type="password"
                            value={passwordConfirmation}
                            onChange={(event) =>
                                setPasswordConfirmation(event.target.value)
                            }
                            autoComplete="new-password"
                            minLength={12}
                            required
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Resetting…' : 'Reset password'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 6: Create `resources/js/pages/admin/staff.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import {
    useLoaderData,
    useRevalidator,
    useRouteLoaderData,
    useSearchParams,
} from 'react-router';
import { ResetPasswordDialog } from '@/components/staff/reset-password-dialog';
import { StaffFormDialog } from '@/components/staff/staff-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { staffLoader } from '@/lib/auth';
import type { staffPageLoader } from '@/lib/staff';
import type { StaffUser } from '@/types';

const lastLoginFormat = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function Staff() {
    const { data: staff, meta } = useLoaderData<typeof staffPageLoader>();
    const current = useRouteLoaderData<typeof staffLoader>('admin');
    const revalidator = useRevalidator();
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(searchParams.get('search') ?? '');
    const [isCreating, setIsCreating] = useState(false);
    const [editing, setEditing] = useState<StaffUser | null>(null);
    const [resetting, setResetting] = useState<StaffUser | null>(null);

    const refresh = () => void revalidator.revalidate();

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSearchParams(search ? { search } : {});
    }

    function goToPage(page: number) {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(page));
        setSearchParams(next);
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl font-extrabold">
                        Staff
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {meta.total} accounts
                    </p>
                </div>
                <Button onClick={() => setIsCreating(true)}>Add staff</Button>
            </div>

            <form
                onSubmit={handleSearch}
                className="flex max-w-md gap-2"
                role="search"
            >
                <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name or email"
                    aria-label="Search staff"
                    maxLength={100}
                />
                <Button type="submit" variant="outline">
                    Search
                </Button>
            </form>

            <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last login</TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {staff.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="py-8 text-center text-muted-foreground"
                                >
                                    No staff found.
                                </TableCell>
                            </TableRow>
                        )}
                        {staff.map((member) => (
                            <TableRow key={member.id}>
                                <TableCell className="font-medium">
                                    {member.name}
                                </TableCell>
                                <TableCell>{member.email}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">
                                        {member.role_label}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {member.is_active ? (
                                        <Badge className="bg-kalamansi text-uling">
                                            Active
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline">
                                            Deactivated
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {member.last_login_at
                                        ? lastLoginFormat.format(
                                              new Date(member.last_login_at),
                                          )
                                        : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditing(member)}
                                        >
                                            Edit
                                        </Button>
                                        {member.id !== current?.user.id && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setResetting(member)
                                                }
                                            >
                                                Reset password
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {meta.last_page > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={meta.current_page <= 1}
                        onClick={() => goToPage(meta.current_page - 1)}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {meta.current_page} of {meta.last_page}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={meta.current_page >= meta.last_page}
                        onClick={() => goToPage(meta.current_page + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}

            {isCreating && (
                <StaffFormDialog
                    staff={null}
                    isSelf={false}
                    onClose={() => setIsCreating(false)}
                    onSaved={refresh}
                />
            )}
            {editing && (
                <StaffFormDialog
                    key={editing.id}
                    staff={editing}
                    isSelf={editing.id === current?.user.id}
                    onClose={() => setEditing(null)}
                    onSaved={refresh}
                />
            )}
            {resetting && (
                <ResetPasswordDialog
                    key={resetting.id}
                    staff={resetting}
                    onClose={() => setResetting(null)}
                />
            )}
        </div>
    );
}
```

- [ ] **Step 7: Final `resources/js/router.tsx`**

```tsx
import { createBrowserRouter } from 'react-router';
import AdminLayout from '@/layouts/admin-layout';
import { authLoader, guestLoader, staffLoader } from '@/lib/auth';
import { staffPageLoader } from '@/lib/staff';
import ChangePassword from '@/pages/account/change-password';
import Dashboard from '@/pages/admin/dashboard';
import Staff from '@/pages/admin/staff';
import Login from '@/pages/auth/login';
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';
import RouteError from '@/pages/route-error';

export const router = createBrowserRouter([
    { path: '/', element: <Home /> },
    { path: '/login', element: <Login />, loader: guestLoader },
    {
        path: '/account/password',
        element: <ChangePassword />,
        loader: authLoader,
        errorElement: <RouteError />,
    },
    {
        id: 'admin',
        path: '/admin',
        element: <AdminLayout />,
        loader: staffLoader,
        errorElement: <RouteError />,
        children: [
            { index: true, element: <Dashboard /> },
            {
                path: 'staff',
                element: <Staff />,
                loader: staffPageLoader,
                errorElement: <RouteError />,
            },
        ],
    },
    { path: '*', element: <NotFound /> },
]);
```

- [ ] **Step 8: Verify the build** — `npm run types:check`, `npm run build`, `npm run check` (use `check:fix` for formatting).

- [ ] **Step 9: Walk through it in the browser** (`composer run dev`)

1. Log in as your admin → `/admin` shows "Magandang araw, …" with **Dashboard** and **Staff** in the sidebar.
2. **Staff** → add a Cashier with a temporary password → they appear in the table, marked Active.
3. Log out, then log in as that cashier → you're sent straight to **Set your own password**. Try an 8-character password (error), then a 12+ character one → you land on `/admin` with **no Staff link**.
4. Visit `http://localhost:8000/admin/staff` directly as the cashier → "You do not have access to this page."
5. Log in as the admin, edit the cashier, and turn **Active** off → in the cashier's still-open browser, refresh → back at `/login`.
6. Edit yourself → the Role and Active controls are disabled, and the Reset password button isn't shown for your own row.

- [ ] **Step 10: Check the dialogs under the production CSP**

Stop `composer run dev` and make sure `public/hot` is gone (delete it if it's still there). Then run `npm run build` and `php artisan serve`, and open `http://localhost:8000/admin/staff` → **Add staff** and the **Role** dropdown. DevTools Console must show **no** `Refused to apply inline style` errors. (This is the strict policy real users get, and the `get-nonce` wiring is what makes it pass.)

- [ ] **Step 11: Checkpoint commit** (Tasks 8–9)

```bash
git add -A
git commit -m "feat: staff login, change password, and staff management UI"
```

---

### Task 10: Module 1 gate

- [ ] **Step 1:** `composer audit` and `npm audit --audit-level=high` → no advisories.
- [ ] **Step 2:** `composer run test` → Pint, PHPStan and every Pest test pass. `npm run check && npm run types:check` → exit 0.
- [ ] **Step 3:** `php artisan route:list --except-vendor -v` → every `api/v1` route shows `auth:sanctum` and `active`; every `api/v1/admin/*` route also shows `password.changed` and `role:admin`; no `register` or `verify-email` routes exist.
- [ ] **Step 4:** Security review against `CLAUDE.md` → _Security Guidelines_: no `$request->all()`, no `$guarded = []`, no `{!! !!}`, no `whereRaw` with input (`grep -rn "request()->all\|->all()\|guarded = \[\]\|whereRaw\|{!!" app resources`).
- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: Module 1 auth and RBAC passes full checks"
```

**Done when:** an admin created from the console can log in, add or edit or deactivate staff, and reset their passwords; staff must replace temporary passwords before doing anything else; cashier and kitchen accounts are refused admin areas at the route, the policy and the UI; every auth event and staff change is in `audit_logs` without passwords; and all checks are green. Next: **Module 2 — Catalog**.
