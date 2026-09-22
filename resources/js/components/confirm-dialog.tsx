import { useState } from 'react';
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
import { HttpError } from '@/lib/http';

type ConfirmDialogProps = {
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
    onClose: () => void;
};

export function ConfirmDialog({
    title,
    description,
    confirmLabel,
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    const [isWorking, setIsWorking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleConfirm() {
        setIsWorking(true);
        setError(null);

        try {
            await onConfirm();
            onClose();
        } catch (caught) {
            setError(
                caught instanceof HttpError
                    ? caught.message
                    : 'Could not reach the server. Try again.',
            );
            setIsWorking(false);
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
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={isWorking}
                        onClick={() => void handleConfirm()}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
