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
import { answerTwoFactorChallenge } from '@/lib/auth';
import { HttpError, type ValidationErrors } from '@/lib/http';

/**
 * The second half of signing in. Nobody is signed in when this screen shows:
 * the password step left only a note of who is waiting.
 */
export default function TwoFactorChallenge() {
    const navigate = useNavigate();
    const [useRecovery, setUseRecovery] = useState(false);
    const [code, setCode] = useState('');
    const [recoveryCode, setRecoveryCode] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setErrors({});
        setFormError(null);

        try {
            await answerTwoFactorChallenge(
                useRecovery ? { recovery_code: recoveryCode } : { code },
            );
            await navigate('/admin');
        } catch (error) {
            if (error instanceof HttpError && error.status === 422) {
                setErrors(error.errors);
            } else if (error instanceof HttpError && error.status === 429) {
                setFormError(
                    'Too many tries. Wait a minute before the next one.',
                );
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
                    <CardTitle className="text-2xl font-bold">
                        One more step
                    </CardTitle>
                    <CardDescription>
                        {useRecovery
                            ? 'Enter one of the recovery codes you saved.'
                            : 'Enter the six digits your authenticator is showing.'}
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

                        {useRecovery ? (
                            <FormField
                                id="recovery_code"
                                label="Recovery code"
                                autoComplete="one-time-code"
                                value={recoveryCode}
                                onChange={(event) =>
                                    setRecoveryCode(event.target.value)
                                }
                                error={errors.recovery_code?.[0]}
                                maxLength={64}
                                required
                                autoFocus
                            />
                        ) : (
                            <FormField
                                id="code"
                                label="Six-digit code"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="123456"
                                value={code}
                                onChange={(event) =>
                                    setCode(event.target.value)
                                }
                                error={errors.code?.[0]}
                                maxLength={7}
                                required
                                autoFocus
                                className="text-center font-display text-2xl tracking-[0.4em]"
                            />
                        )}

                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Checking…' : 'Sign in'}
                        </Button>

                        <button
                            type="button"
                            onClick={() => {
                                setUseRecovery((current) => !current);
                                setErrors({});
                            }}
                            className="text-sm text-muted-foreground underline underline-offset-4"
                        >
                            {useRecovery
                                ? 'Use my authenticator instead'
                                : 'Lost your phone? Use a recovery code'}
                        </button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
