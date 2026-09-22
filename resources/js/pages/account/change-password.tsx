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
