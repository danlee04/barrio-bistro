<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * PayMongo signs every event with the endpoint's webhook secret. Anything that
 * does not carry a fresh, matching signature is discarded: PayMongo did not
 * send it.
 */
class VerifyPayMongoSignature
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('paymongo.webhook_secret');

        if ($secret === '' || ! $this->verified($request, $secret)) {
            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        return $next($request);
    }

    /**
     * The signed string is "<timestamp>.<raw body>", hashed with HMAC-SHA256.
     */
    private function verified(Request $request, string $secret): bool
    {
        $parts = $this->parse((string) $request->header('Paymongo-Signature', ''));
        $timestamp = $parts['t'] ?? '';

        if (! ctype_digit($timestamp)) {
            return false;
        }

        if (abs(time() - (int) $timestamp) > (int) config('paymongo.signature_tolerance')) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp.'.'.$request->getContent(), $secret);

        foreach (['te', 'li'] as $mode) {
            $given = $parts[$mode] ?? '';

            if ($given !== '' && hash_equals($expected, $given)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Read "t=...,te=...,li=..." into its parts.
     *
     * @return array<string, string>
     */
    private function parse(string $header): array
    {
        $parts = [];

        foreach (explode(',', $header) as $piece) {
            [$key, $value] = array_pad(explode('=', trim($piece), 2), 2, '');
            $parts[$key] = $value;
        }

        return $parts;
    }
}
