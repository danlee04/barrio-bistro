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
import { login } from '@/lib/auth';
import { HttpError, type ValidationErrors } from '@/lib/http';

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setErrors({});
        setFormError(null);

        try {
            await login(email, password);
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
            setIsSubmitting(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-dahon p-6">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">
                        Staff login
                    </CardTitle>
                    <CardDescription>
                        For Barrio Bistro staff only.
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
                            id="email"
                            label="Email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            error={errors.email?.[0]}
                            maxLength={255}
                            required
                            autoFocus
                        />
                        <FormField
                            id="password"
                            label="Password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            error={errors.password?.[0]}
                            maxLength={255}
                            required
                        />
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Logging in…' : 'Log in'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
