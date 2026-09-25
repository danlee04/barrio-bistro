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
use Illuminate\Http\Middleware\TrustProxies;
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
        $this->configureTrustedProxies();
        $this->configureRateLimiting();
        $this->configureAuthorization();
        $this->configureAuditTrail();
    }

    /**
     * Tell the app which proxies may speak for the visitor.
     *
     * Without this, everything behind a load balancer or CDN reports the
     * proxy's address: every rate limiter below collapses into one bucket that
     * a single attacker can empty for everybody, and HSTS is never sent
     * because the request looks like plain HTTP. The forwarded *host* stays
     * untrusted — nothing here needs it, and trusting it would let a caller
     * poison the host used to build URLs.
     *
     * It is set here rather than in `bootstrap/app.php` because the middleware
     * closure there runs before the config repository exists.
     */
    protected function configureTrustedProxies(): void
    {
        $proxies = config('security.trusted_proxies');

        if (! is_array($proxies) || $proxies === []) {
            return;
        }

        TrustProxies::at(count($proxies) === 1 && $proxies[0] === '*' ? '*' : $proxies);
        TrustProxies::withHeaders(
            Request::HEADER_X_FORWARDED_FOR
            | Request::HEADER_X_FORWARDED_PORT
            | Request::HEADER_X_FORWARDED_PROTO
        );
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
        RateLimiter::for('api', function (Request $request): Limit {
            $user = $request->user();

            return $user !== null
                ? Limit::perMinute(60)->by('user:'.$user->getAuthIdentifier())
                : Limit::perMinute(300)->by('ip:'.$request->ip());
        });

        RateLimiter::for('login', fn (Request $request): Limit => Limit::perMinute(20)
            ->by($request->ip()));

        // The second factor is six digits. Held tighter than the password step,
        // because the password is already known by the time anyone gets here.
        //
        // Counted against the account being challenged rather than the session:
        // a session is the attacker's to throw away and ask for a new one, but
        // the account they are aiming at cannot be changed.
        RateLimiter::for('two-factor', function (Request $request): array {
            $limits = [Limit::perMinute(10)->by('ip:'.$request->ip())];
            $pending = $request->hasSession()
                ? $request->session()->get('two_factor.id')
                : null;

            if (is_int($pending) || is_string($pending)) {
                $limits[] = Limit::perMinute(5)->by('two-factor:'.$pending);
            }

            return $limits;
        });

        // A restaurant full of guests shares one connection, so the tighter
        // limit is per device and the looser one per address.
        RateLimiter::for('orders', function (Request $request): array {
            $limits = [Limit::perMinute(30)->by('ip:'.$request->ip())];

            if ($request->hasSession()) {
                $limits[] = Limit::perMinute(6)->by('device:'.$request->session()->getId());
            }

            return $limits;
        });

        // A public write with no account behind it, so it is held by address
        // alone: a few in a minute for someone correcting a typo, and not many
        // in an hour, because nobody writes to a restaurant ten times a day.
        RateLimiter::for('inquiries', fn (Request $request): array => [
            Limit::perMinute(3)->by('ip:'.$request->ip()),
            Limit::perHour(10)->by('ip:'.$request->ip()),
        ]);

        // Starting a payment costs us a provider call, so it is held tighter
        // than ordinary reads. Ten is generous for one guest and cheap for us.
        RateLimiter::for('payments', function (Request $request): array {
            $limits = [Limit::perMinute(10)->by('ip:'.$request->ip())];

            if ($request->hasSession()) {
                $limits[] = Limit::perMinute(10)->by('device:'.$request->session()->getId());
            }

            return $limits;
        });
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
