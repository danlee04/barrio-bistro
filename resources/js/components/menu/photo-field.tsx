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
import { MAX_ORIGINAL_BYTES, prepareMenuPhoto } from '@/lib/photo';
import type { MenuItem } from '@/types';

type PhotoFieldProps = {
    item: MenuItem;
    onChanged: () => void;
};

export function PhotoField({ item, onChanged }: PhotoFieldProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isWorking, setIsWorking] = useState(false);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    function clearSelection() {
        setFile(null);
        setPreviewUrl(null);
        setNotice(null);
    }

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0] ?? null;
        setError(null);
        clearSelection();

        if (selected === null) {
            return;
        }

        if (selected.size > MAX_ORIGINAL_BYTES) {
            setError('That file is over 25 MB. Choose a smaller photo.');

            return;
        }

        setIsPreparing(true);

        try {
            const prepared = await prepareMenuPhoto(selected);

            setFile(prepared.file);
            setPreviewUrl(URL.createObjectURL(prepared.file));
            setNotice(
                prepared.wasUpscaled
                    ? 'This photo is smaller than 800×800, so it may look a little blurry.'
                    : null,
            );
        } catch {
            setError(
                'This file could not be read as a photo. Use a JPG, PNG or WebP image.',
            );
        } finally {
            setIsPreparing(false);
        }
    }

    async function run(action: () => Promise<unknown>) {
        setIsWorking(true);
        setError(null);

        try {
            await action();
            clearSelection();
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
                    Any JPG, PNG or WebP photo. It is cut to its centre and
                    resized to 800×800 automatically, shown as a round plate.
                    Location data is removed.
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
                    disabled={isPreparing || isWorking}
                    onChange={(event) => void handleFileChange(event)}
                />
                {isPreparing && (
                    <p className="text-sm text-muted-foreground" role="status">
                        Preparing photo…
                    </p>
                )}
                {notice && (
                    <p className="text-sm text-muted-foreground" role="status">
                        {notice}
                    </p>
                )}
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <div className="flex gap-2">
                    <Button
                        type="button"
                        disabled={!file || isWorking || isPreparing}
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
