import { useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { HttpError } from '@/lib/http';
import { removeMenuItemPhoto, uploadMenuItemPhoto } from '@/lib/menu';
import type { MenuItem } from '@/types';

const MAX_BYTES = 5 * 1024 * 1024;

type PhotoFieldProps = {
    item: MenuItem;
    onChanged: () => void;
};

export function PhotoField({ item, onChanged }: PhotoFieldProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isWorking, setIsWorking] = useState(false);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0] ?? null;
        setError(null);

        if (selected && selected.size > MAX_BYTES) {
            setError('Photos must be 5 MB or smaller.');
            setFile(null);
            setPreviewUrl(null);

            return;
        }

        setFile(selected);
        setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
    }

    async function run(action: () => Promise<unknown>) {
        setIsWorking(true);
        setError(null);

        try {
            await action();
            setFile(null);
            setPreviewUrl(null);
            onChanged();
        } catch (caught) {
            setError(
                caught instanceof HttpError
                    ? (caught.errors.photo?.[0] ?? caught.message)
                    : 'Could not reach the server. Try again.',
            );
        } finally {
            setIsWorking(false);
        }
    }

    const shown = previewUrl ?? item.image?.md ?? null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Photo</CardTitle>
                <CardDescription>
                    Shown as a round plate. At least 800×800 pixels; JPG, PNG or
                    WebP; up to 5 MB. Location data is removed automatically.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-4">
                {shown ? (
                    <img
                        src={shown}
                        alt={item.name}
                        width={200}
                        height={200}
                        className="size-50 rounded-full object-cover"
                    />
                ) : (
                    <div className="flex size-50 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
                        No photo yet
                    </div>
                )}
                <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Choose a photo"
                    onChange={handleFileChange}
                />
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <div className="flex gap-2">
                    <Button
                        type="button"
                        disabled={!file || isWorking}
                        onClick={() => {
                            if (file) {
                                void run(() =>
                                    uploadMenuItemPhoto(item.id, file),
                                );
                            }
                        }}
                    >
                        {isWorking ? 'Saving…' : 'Upload photo'}
                    </Button>
                    {item.image && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isWorking}
                            onClick={() =>
                                void run(() => removeMenuItemPhoto(item.id))
                            }
                        >
                            Remove photo
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
