<?php

namespace App\Providers;

use App\Models\AuditLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
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
        $this->configureRateLimiting();
        $this->configureAuthorization();
        $this->configureAuditTrail();
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

    /**
     * Active admins may do everything; everyone else goes through policies and gates.
     */
    protected function configureAuthorization(): void
    {
        Gate::before(fn (User $user): ?bool => $user->isAdmin() && $user->is_active ? true : null);
    }

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
    }
}
