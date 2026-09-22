import { useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { HttpError, type ValidationErrors } from '@/lib/http';
import { resetStaffPassword } from '@/lib/staff';
import type { StaffUser } from '@/types';

type ResetPasswordDialogProps = {
    staff: StaffUser;
    onClose: () => void;
};

export function ResetPasswordDialog({
    staff,
    onClose,
}: ResetPasswordDialogProps) {
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDone, setIsDone] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSaving(true);
        setErrors({});
        setFormError(null);

        try {
            await resetStaffPassword(staff.id, {
                password,
                password_confirmation: passwordConfirmation,
            });
            setIsDone(true);
        } catch (error) {
            if (error instanceof HttpError && error.status === 422) {
                setErrors(error.errors);
            } else {
                setFormError(
                    error instanceof HttpError
                        ? error.message
                        : 'Could not reach the server. Try again.',
                );
            }
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reset password for {staff.name}</DialogTitle>
                    <DialogDescription>
                        They will be signed out everywhere and must choose a new
                        password at their next login.
                    </DialogDescription>
                </DialogHeader>

                {isDone ? (
                    <div className="grid gap-4">
                        <Alert>
                            <AlertDescription>
                                Password reset. Give the temporary password to{' '}
                                {staff.name} in person, not by chat.
                            </AlertDescription>
                        </Alert>
                        <DialogFooter>
                            <Button onClick={onClose}>Done</Button>
                        </DialogFooter>
                    </div>
                ) : (
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
                            id="reset-password"
                            label="New temporary password"
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            error={errors.password?.[0]}
                            autoComplete="new-password"
                            minLength={12}
                            required
                        />
                        <FormField
                            id="reset-password-confirmation"
                            label="Confirm temporary password"
                            type="password"
                            value={passwordConfirmation}
                            onChange={(event) =>
                                setPasswordConfirmation(event.target.value)
                            }
                            autoComplete="new-password"
                            minLength={12}
                            required
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Resetting…' : 'Reset password'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
