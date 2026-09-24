import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    adminGalleryLoader,
    deleteGalleryPhoto,
    moveGalleryPhoto,
    updateGalleryCaption,
    uploadGalleryPhoto,
} from '@/lib/gallery';
import { HttpError } from '@/lib/http';
import { MAX_ORIGINAL_BYTES, preparePhoto } from '@/lib/photo';
import type { GalleryPhoto } from '@/types';

/** The caption the server accepts, so the count here matches the rule there. */
const MAX_CAPTION = 120;

function errorMessage(caught: unknown, field: string): string {
    if (caught instanceof HttpError) {
        return caught.errors[field]?.[0] ?? caught.message;
    }

    return 'Could not reach the server. Try again.';
}

export default function AdminGallery() {
    const photos = useLoaderData<typeof adminGalleryLoader>();
    const revalidator = useRevalidator();
    const [removing, setRemoving] = useState<GalleryPhoto | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const refresh = () => void revalidator.revalidate();

    async function run(action: () => Promise<unknown>) {
        setActionError(null);

        try {
            await action();
            refresh();
        } catch (caught) {
            setActionError(errorMessage(caught, 'photo'));
        }
    }

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold">Gallery</h1>
                <p className="text-muted-foreground">
                    These photos appear on the website, in this order.
                </p>
            </div>

            <UploadCard onAdded={refresh} />

            {actionError && (
                <Alert variant="destructive">
                    <AlertDescription>{actionError}</AlertDescription>
                </Alert>
            )}

            {photos.length === 0 ? (
                <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                    No photos yet. Add the first one above.
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {photos.map((photo, index) => (
                        <PhotoRow
                            key={photo.id}
                            photo={photo}
                            isFirst={index === 0}
                            isLast={index === photos.length - 1}
                            onMove={(direction) =>
                                void run(() =>
                                    moveGalleryPhoto(photo.id, direction),
                                )
                            }
                            onRemove={() => setRemoving(photo)}
                            onSaved={refresh}
                        />
                    ))}
                </ul>
            )}

            {removing && (
                <ConfirmDialog
                    title="Remove this photo?"
                    description="It disappears from the website and the file is deleted. This cannot be undone."
                    confirmLabel="Remove"
                    onConfirm={async () => {
                        await deleteGalleryPhoto(removing.id);
                        refresh();
                    }}
                    onClose={() => setRemoving(null)}
                />
            )}
        </div>
    );
}

function UploadCard({ onAdded }: { onAdded: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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
            const prepared = await preparePhoto(selected);

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

    async function handleUpload() {
        if (file === null) {
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await uploadGalleryPhoto(file, caption.trim());
            clearSelection();
            setCaption('');
            onAdded();
        } catch (caught) {
            setError(errorMessage(caught, 'photo'));
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Add a photo</CardTitle>
                <CardDescription>
                    Any JPG, PNG or WebP photo. It is cut to its centre square
                    and resized to 800×800 automatically. Location data is
                    removed.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start gap-4">
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt="The photo you chose"
                            width={112}
                            height={112}
                            className="size-28 rounded-lg object-cover"
                        />
                    ) : (
                        <div
                            aria-hidden="true"
                            className="flex size-28 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground"
                        >
                            No photo
                        </div>
                    )}

                    <div className="flex min-w-60 flex-1 flex-col gap-3">
                        <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            aria-label="Choose a photo"
                            disabled={isPreparing || isSaving}
                            onChange={(event) => void handleFileChange(event)}
                        />

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="new-caption">
                                Caption (optional)
                            </Label>
                            <Input
                                id="new-caption"
                                value={caption}
                                maxLength={MAX_CAPTION}
                                placeholder="Sunday lunch at the corner table"
                                onChange={(event) =>
                                    setCaption(event.target.value)
                                }
                            />
                        </div>
                    </div>
                </div>

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

                <div>
                    <Button
                        type="button"
                        disabled={!file || isPreparing || isSaving}
                        onClick={() => void handleUpload()}
                    >
                        {isSaving ? 'Adding…' : 'Add photo'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

type PhotoRowProps = {
    photo: GalleryPhoto;
    isFirst: boolean;
    isLast: boolean;
    onMove: (direction: 'up' | 'down') => void;
    onRemove: () => void;
    onSaved: () => void;
};

function PhotoRow({
    photo,
    isFirst,
    isLast,
    onMove,
    onRemove,
    onSaved,
}: PhotoRowProps) {
    const [caption, setCaption] = useState(photo.caption ?? '');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const isChanged = caption.trim() !== (photo.caption ?? '');

    async function handleSave() {
        setIsSaving(true);
        setError(null);

        try {
            const trimmed = caption.trim();
            await updateGalleryCaption(
                photo.id,
                trimmed === '' ? null : trimmed,
            );
            onSaved();
        } catch (caught) {
            setError(errorMessage(caught, 'caption'));
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <li className="flex flex-wrap items-start gap-4 rounded-lg border bg-card p-3">
            <img
                src={photo.image.sm}
                alt={photo.caption ?? ''}
                width={80}
                height={80}
                loading="lazy"
                className="size-20 rounded-md object-cover"
            />

            <div className="flex min-w-60 flex-1 flex-col gap-2">
                <Label htmlFor={`caption-${photo.id}`} className="sr-only">
                    Caption
                </Label>
                <Input
                    id={`caption-${photo.id}`}
                    value={caption}
                    maxLength={MAX_CAPTION}
                    placeholder="No caption"
                    onChange={(event) => setCaption(event.target.value)}
                />
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                {isChanged && (
                    <div>
                        <Button
                            size="sm"
                            disabled={isSaving}
                            onClick={() => void handleSave()}
                        >
                            {isSaving ? 'Saving…' : 'Save caption'}
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex gap-1">
                <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move this photo up"
                    disabled={isFirst}
                    onClick={() => onMove('up')}
                >
                    <ChevronUpIcon />
                </Button>
                <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move this photo down"
                    disabled={isLast}
                    onClick={() => onMove('down')}
                >
                    <ChevronDownIcon />
                </Button>
                <Button size="sm" variant="ghost" onClick={onRemove}>
                    Remove
                </Button>
            </div>
        </li>
    );
}
