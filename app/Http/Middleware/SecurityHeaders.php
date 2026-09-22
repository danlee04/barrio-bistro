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
