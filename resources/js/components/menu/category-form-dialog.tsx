import { useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { HttpError, type ValidationErrors } from '@/lib/http';
import { createCategory, updateCategory } from '@/lib/menu';
import type { Category } from '@/types';

type CategoryFormDialogProps = {
    category: Category | null;
    onClose: () => void;
    onSaved: () => void;
};

export function CategoryFormDialog({
    category,
    onClose,
    onSaved,
}: CategoryFormDialogProps) {
    const [name, setName] = useState(category?.name ?? '');
    const [description, setDescription] = useState(category?.description ?? '');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSaving(true);
        setErrors({});
        setFormError(null);

        const input = {
            name,
            description: description.trim() === '' ? null : description,
        };

        try {
            if (category === null) {
                await createCategory(input);
            } else {
                await updateCategory(category.id, input);
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
                            {category === null
                                ? 'Add category'
                                : `Edit ${category.name}`}
                        </DialogTitle>
                    </DialogHeader>
                    {formError && (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}
                    <FormField
                        id="category-name"
                        label="Name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        error={errors.name?.[0]}
                        maxLength={60}
                        required
                    />
                    <FormField
                        id="category-description"
                        label="Description (optional)"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        error={errors.description?.[0]}
                        maxLength={255}
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
                            {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
