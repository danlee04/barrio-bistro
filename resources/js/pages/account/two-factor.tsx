import { Check, Copy } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';
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
import {
    confirmTwoFactor,
    disableTwoFactor,
    replaceRecoveryCodes,
    startTwoFactorSetup,
    type twoFactorLoader,
    type TwoFactorSetup,
} from '@/lib/auth';
import { HttpError, type ValidationErrors } from '@/lib/http';

/** Broken into fours so the eye can keep its place while typing it in. */
function grouped(secret: string): string {
    return (secret.match(/.{1,4}/g) ?? [secret]).join(' ');
}

function CopyButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={label}
            onClick={() => {
                void navigator.clipboard.writeText(value).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                });
            }}
        >
            {copied ? (
                <Check aria-hidden="true" />
            ) : (
                <Copy aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy'}
        </Button>
    );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-achuete bg-achuete/10 p-4">
            <p className="font-semibold">
                Save these somewhere safe. They will not be shown again.
            </p>
            <p className="text-sm text-muted-foreground">
                Each one signs you in once if you lose your phone. Without them,
                a lost phone means a locked account.
            </p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-display tabular-nums">
                {codes.map((code) => (
                    <li key={code}>{code}</li>
                ))}
            </ul>
            <div>
                <CopyButton value={codes.join('\n')} label="Copy all codes" />
            </div>
        </div>
    );
}

export default function TwoFactor() {
    const status = useLoaderData<typeof twoFactorLoader>();
    const revalidator = useRevalidator();

    const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [codes, setCodes] = useState<string[] | null>(null);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isWorking, setIsWorking] = useState(false);

    async function run(action: () => Promise<void>) {
        setIsWorking(true);
        setErrors({});
        setFormError(null);

        try {
            await action();
        } catch (error) {
            if (error instanceof HttpError && error.status === 422) {
                setErrors(error.errors);
            } else {
                setFormError('Could not reach the server. Try again.');
            }
        } finally {
            setIsWorking(false);
        }
    }

    async function handleConfirm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        await run(async () => {
            setCodes(await confirmTwoFactor(code));
            setSetup(null);
            setCode('');
            void revalidator.revalidate();
        });
    }

    return (
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Two-step sign-in</h1>
                <p className="text-muted-foreground">
                    {status.required
                        ? 'Admins need this on. Your password alone opens the till, the customers’ details and the day’s money.'
                        : 'A code from your phone, on top of your password.'}
                </p>
            </div>

            {formError && (
                <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                </Alert>
            )}

            {codes !== null && <RecoveryCodes codes={codes} />}

            {status.enabled ? (
                <Card>
                    <CardHeader>
                        <CardTitle>It is on</CardTitle>
                        <CardDescription>
                            {status.recovery_codes_left} recovery{' '}
                            {status.recovery_codes_left === 1
                                ? 'code'
                                : 'codes'}{' '}
                            left.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <FormField
                            id="password"
                            label="Your password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            error={errors.password?.[0]}
                        />
                        <p className="text-sm text-muted-foreground">
                            Asked for again because turning this off, or taking
                            new codes, is the first thing somebody on your
                            screen would try.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isWorking}
                                onClick={() =>
                                    void run(async () => {
                                        setCodes(
                                            await replaceRecoveryCodes(
                                                password,
                                            ),
                                        );
                                        setPassword('');
                                        void revalidator.revalidate();
                                    })
                                }
                            >
                                New recovery codes
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={isWorking}
                                onClick={() =>
                                    void run(async () => {
                                        await disableTwoFactor(password);
                                        setPassword('');
                                        setCodes(null);
                                        void revalidator.revalidate();
                                    })
                                }
                            >
                                Turn it off
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : setup === null ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Turn it on</CardTitle>
                        <CardDescription>
                            You will need an authenticator app: Google
                            Authenticator, Microsoft Authenticator, Authy or a
                            password manager that does codes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            type="button"
                            disabled={isWorking}
                            onClick={() =>
                                void run(async () => {
                                    setSetup(await startTwoFactorSetup());
                                })
                            }
                        >
                            Start
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Scan this</CardTitle>
                        <CardDescription>
                            In your authenticator, add an account and point the
                            camera here.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-5">
                        <img
                            src={setup.qr}
                            alt=""
                            width={232}
                            height={232}
                            className="self-start rounded-lg border border-border bg-white p-2"
                        />

                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground">
                                No camera? Choose “Enter a setup key” and type
                                this instead.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <code className="rounded-md bg-muted px-3 py-2 font-display tracking-wider">
                                    {grouped(setup.secret)}
                                </code>
                                <CopyButton
                                    value={setup.secret}
                                    label="Copy the setup key"
                                />
                            </div>
                        </div>

                        <form
                            onSubmit={(event) => void handleConfirm(event)}
                            className="flex flex-col gap-3"
                        >
                            <FormField
                                id="code"
                                label="Now type the six digits it shows"
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
                            />
                            <div>
                                <Button type="submit" disabled={isWorking}>
                                    {isWorking ? 'Checking…' : 'Turn it on'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {status.enabled && (
                <Link
                    to="/admin"
                    className="text-sm underline underline-offset-4"
                >
                    Back to the admin
                </Link>
            )}
        </main>
    );
}
