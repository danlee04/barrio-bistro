<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * The settings that have to be right before this is reachable from the
 * internet, in a form you can run rather than a page nobody opens.
 *
 * Run it on the server after deploying. A failure means stop.
 */
#[Signature('app:check-production')]
#[Description('Check the settings that must be right before the shop goes live')]
class CheckProductionCommand extends Command
{
    public function handle(): int
    {
        $failed = 0;
        $warned = 0;

        foreach ($this->checks() as [$label, $passed, $fatal, $hint]) {
            if ($passed) {
                $this->components->twoColumnDetail($label, '<fg=green>ok</>');

                continue;
            }

            $this->components->twoColumnDetail(
                $label,
                $fatal ? '<fg=red;options=bold>FAILED</>' : '<fg=yellow>check</>',
            );
            $this->components->bulletList([$hint]);

            $fatal ? $failed++ : $warned++;
        }

        $this->newLine();

        if ($failed > 0) {
            $this->components->error("{$failed} must be fixed before this goes live.");

            return self::FAILURE;
        }

        if ($warned > 0) {
            $this->components->warn("Nothing fatal, but {$warned} worth a look.");

            return self::SUCCESS;
        }

        $this->components->info('Ready.');

        return self::SUCCESS;
    }

    /**
     * Each check: what it is, whether it passed, whether failing it stops the
     * deploy, and what to do about it.
     *
     * @return list<array{0: string, 1: bool, 2: bool, 3: string}>
     */
    private function checks(): array
    {
        $url = (string) config('app.url');
        $paymongoKey = (string) config('paymongo.secret_key');

        return [
            [
                'Environment is production',
                config('app.env') === 'production',
                true,
                'Set APP_ENV=production. Several defaults below key off it.',
            ],
            [
                'Debug mode is off',
                config('app.debug') === false,
                true,
                'Set APP_DEBUG=false. With it on, an error page prints every secret in the environment.',
            ],
            [
                'Application key is set',
                (string) config('app.key') !== '',
                true,
                'Run php artisan key:generate. Without it nothing encrypted can be read back.',
            ],
            [
                'Site address is HTTPS',
                Str::startsWith($url, 'https://'),
                true,
                'Set APP_URL to the https address. Links and redirects are built from it.',
            ],
            [
                'Session cookie is HTTPS-only',
                config('session.secure') === true,
                true,
                'Set SESSION_SECURE_COOKIE=true, or leave it blank with APP_ENV=production.',
            ],
            [
                'Session payload is encrypted',
                config('session.encrypt') === true,
                true,
                'Set SESSION_ENCRYPT=true.',
            ],
            [
                'Content Security Policy is enforced',
                config('security.csp_report_only') === false,
                true,
                'Set CSP_REPORT_ONLY=false. Report-only mode logs attacks instead of stopping them.',
            ],
            [
                'PayMongo webhook secret is set',
                $paymongoKey === '' || (string) config('paymongo.webhook_secret') !== '',
                true,
                'A secret key without PAYMONGO_WEBHOOK_SECRET means every webhook is rejected and no online payment ever confirms.',
            ],
            [
                'Uploads are reachable',
                // is_dir() alone on purpose: it follows the link, so a symlink
                // pointing at nothing is correctly called unreachable. Asking
                // is_link() first would also poison PHP's stat cache and make
                // the is_dir() after it answer about the link, not the target.
                is_dir(public_path('storage')),
                true,
                'Run php artisan storage:link, or every menu and gallery photo 404s.',
            ],
            [
                'Trusted proxies are named',
                config('security.trusted_proxies') !== [],
                false,
                'Only needed behind a load balancer or CDN. Without TRUSTED_PROXIES every rate limiter counts the proxy instead of the visitor.',
            ],
            [
                'Configuration is cached',
                $this->laravel->configurationIsCached(),
                false,
                'Run php artisan config:cache. Without it the .env file is read on every request.',
            ],
            [
                'Routes are cached',
                $this->laravel->routesAreCached(),
                false,
                'Run php artisan route:cache.',
            ],
            [
                'Events are cached',
                $this->laravel->eventsAreCached(),
                false,
                'Run php artisan event:cache.',
            ],
        ];
    }
}
