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
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { HttpError, type ValidationErrors } from '@/lib/http';
import { createStaff, updateStaff } from '@/lib/staff';
import type { Role, StaffUser } from '@/types';

const roleOptions: { value: Role; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'kitchen', label: 'Kitchen' },
];

function isRole(value: string): value is Role {
    return roleOptions.some((option) => option.value === value);
}

type StaffFormDialogProps = {
    staff: StaffUser | null;
    isSelf: boolean;
    onClose: () => void;
    onSaved: () => void;
};

export function StaffFormDialog({
    staff,
    isSelf,
    onClose,
    onSaved,
}: StaffFormDialogProps) {
    const [name, setName] = useState(staff?.name ?? '');
    const [email, setEmail] = useState(staff?.email ?? '');
    const [role, setRole] = useState<Role>(staff?.role ?? 'kitchen');
    const [isActive, setIsActive] = useState(staff?.is_active ?? true);
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
            if (staff === null) {
                await createStaff({
                    name,
                    email,
                    role,
                    password,
                    password_confirmation: passwordConfirmation,
                });
            } else {
                await updateStaff(staff.id, {
                    name,
                    email,
                    role,
                    is_active: isActive,
                });
            }

            onSaved();
            onClose();
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
                <form
                    onSubmit={(event) => void handleSubmit(event)}
                    className="grid gap-4"
                >
                    <DialogHeader>
                        <DialogTitle>
                            {staff === null
                                ? 'Add staff'
                                : `Edit ${staff.name}`}
                        </DialogTitle>
                        <DialogDescription>
                            {staff === null
                                ? 'They must change this temporary password when they first log in. Hand it over in person.'
                                : 'Changes apply on their next request.'}
                        </DialogDescription>
                    </DialogHeader>

                    {formError && (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}

                    <FormField
                        id="staff-name"
                        label="Name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        error={errors.name?.[0]}
                        maxLength={255}
                        autoComplete="off"
                        required
                    />
                    <FormField
                        id="staff-email"
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        error={errors.email?.[0]}
                        maxLength={255}
                        autoComplete="off"
                        required
                    />

                    <div className="grid gap-2">
                        <Label htmlFor="staff-role">Role</Label>
                        <Select
                            value={role}
                            onValueChange={(value) => {
                                if (isRole(value)) {
                                    setRole(value);
                                }
                            }}
                            disabled={isSelf}
                        >
                            <SelectTrigger
                                id="staff-role"
                                aria-invalid={errors.role ? true : undefined}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {roleOptions.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.role && (
                            <p className="text-sm text-destructive">
                                {errors.role[0]}
                            </p>
                        )}
                    </div>

                    {staff === null ? (
                        <>
                            <FormField
                                id="staff-password"
                                label="Temporary password"
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
                                id="staff-password-confirmation"
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
                        </>
                    ) : (
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                                <Label htmlFor="staff-active">
                                    Active account
                                </Label>
                                <Switch
                                    id="staff-active"
                                    checked={isActive}
                                    onCheckedChange={setIsActive}
                                    disabled={isSelf}
                                />
                            </div>
                            {errors.is_active && (
                                <p className="text-sm text-destructive">
                                    {errors.is_active[0]}
                                </p>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
