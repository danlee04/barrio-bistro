<?php

namespace App\Services;

use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

/**
 * Everything the second factor does, in one place.
 *
 * The six digits are worked out on the phone and on the server from the same
 * secret and the same clock — nothing is ever sent between them, which is why
 * this costs nothing to run and keeps working with no signal.
 */
class TwoFactorAuthenticator
{
    /** How many recovery codes a staff member gets, and how long each one is. */
    private const RECOVERY_CODES = 8;

    private const RECOVERY_CODE_BYTES = 5;

    /**
     * Half-minute steps of clock drift allowed either side of now. One is the
     * usual figure: every step widened is another code the server will accept
     * at the same moment.
     */
    private const WINDOW = 1;

    public function __construct(private readonly Google2FA $google2fa) {}

    /**
     * A fresh secret, not yet attached to anybody.
     */
    public function newSecret(): string
    {
        return $this->google2fa->generateSecretKey(32);
    }

    /**
     * The `otpauth://` address an authenticator app expects.
     */
    public function setupUri(User $user, string $secret): string
    {
        return $this->google2fa->getQRCodeUrl(
            (string) config('app.name'),
            $user->email,
            $secret,
        );
    }

    /**
     * The same address as a QR code, ready to drop into an <img src>.
     *
     * An SVG data URI rather than a PNG: it stays sharp at any size, needs no
     * image library on the server, and `img-src data:` is already allowed by
     * the Content Security Policy.
     */
    public function qrCode(User $user, string $secret): string
    {
        $svg = (new Writer(
            new ImageRenderer(new RendererStyle(232, 0), new SvgImageBackEnd),
        ))->writeString($this->setupUri($user, $secret));

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }

    /**
     * Check a code against a secret the user has not committed to yet.
     */
    public function isValidFor(string $secret, string $code): bool
    {
        return $this->google2fa->verifyKey($secret, $code, self::WINDOW) !== false;
    }

    /**
     * Check a code against the user's live secret and spend it.
     *
     * A code accepted once is dead: the step it belonged to is written down,
     * and `verifyKeyNewer` refuses anything at or before it. Without this, a
     * code read over somebody's shoulder would work for another half minute.
     */
    public function verify(User $user, string $code): bool
    {
        $secret = $user->two_factor_secret;

        if ($secret === null) {
            return false;
        }

        // Zero rather than null on purpose. Given null, the library reports
        // only "yes" instead of which half-minute matched, and (int) true is 1
        // — a nonsense step that would leave every code replayable. Zero is
        // clamped up to "now minus the window", so it costs nothing.
        $step = $this->google2fa->verifyKeyNewer(
            $secret,
            $code,
            $user->two_factor_last_step ?? 0,
            self::WINDOW,
        );

        if ($step === false) {
            return false;
        }

        $user->forceFill(['two_factor_last_step' => (int) $step])->save();

        return true;
    }

    /**
     * Eight codes for the day the phone is lost, in a shape that is hard to
     * mistype and easy to read aloud.
     *
     * @return list<string>
     */
    public function newRecoveryCodes(): array
    {
        return array_map(
            fn (): string => Str::lower(bin2hex(random_bytes(self::RECOVERY_CODE_BYTES))),
            range(1, self::RECOVERY_CODES),
        );
    }

    /**
     * Hash each code before it is stored, the way a password is: the list in
     * the database is then worth nothing to whoever steals it.
     *
     * @param  list<string>  $codes
     * @return list<string>
     */
    public function hashRecoveryCodes(array $codes): array
    {
        return array_map(fn (string $code): string => Hash::make($code), $codes);
    }

    /**
     * Spend one recovery code. Each works once and is then struck off.
     */
    public function useRecoveryCode(User $user, string $code): bool
    {
        $stored = $user->two_factor_recovery_codes ?? [];
        $candidate = Str::lower(trim($code));

        foreach ($stored as $index => $hash) {
            if (! Hash::check($candidate, $hash)) {
                continue;
            }

            unset($stored[$index]);
            $user->forceFill([
                'two_factor_recovery_codes' => array_values($stored),
            ])->save();

            return true;
        }

        return false;
    }
}
