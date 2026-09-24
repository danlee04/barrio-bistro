<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A way to reply: an email address, or a Philippine mobile number written
 * however the person happens to write it (0917…, +63 917…, 917…).
 */
class EmailOrPhone implements ValidationRule
{
    /**
     * Run the validation rule.
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (is_string($value) && ($this->isEmail($value) || $this->isMobileNumber($value))) {
            return;
        }

        $fail('Leave an email address or a mobile number we can reply to.');
    }

    private function isEmail(string $value): bool
    {
        return filter_var(trim($value), FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Spaces, dashes and brackets are dropped before the digits are read.
     */
    private function isMobileNumber(string $value): bool
    {
        $digits = preg_replace('/\D/', '', $value);

        return is_string($digits) && preg_match('/^(63)?0?9\d{9}$/', $digits) === 1;
    }
}
