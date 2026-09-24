import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Link, useLoaderData } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { restaurant } from '@/content/restaurant';
import type { galleryLoader } from '@/lib/gallery';
import { cn } from '@/lib/utils';
import type { GalleryPhoto } from '@/types';

/** Every fifth photo takes a bigger tile, so the wall has a rhythm. */
function isFeature(index: number): boolean {
    return index % 5 === 0;
}

export default function Gallery() {
    const photos = useLoaderData<typeof galleryLoader>();
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const shown = openIndex === null ? null : (photos[openIndex] ?? null);

    function step(by: number) {
        setOpenIndex((current) =>
            current === null
                ? null
                : (current + by + photos.length) % photos.length,
        );
    }

    function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === 'ArrowRight') {
            step(1);
        }

        if (event.key === 'ArrowLeft') {
            step(-1);
        }
    }

    return (
        <>
            <title>{`Gallery | ${restaurant.name}`}</title>
            <meta
                name="description"
                content="Photos from the shop: the plates, the kitchen and the room."
            />

            <section className="bg-dahon text-pandan">
                <div className="wrapper flex flex-col gap-4 py-12 md:py-16">
                    <p className="text-sm font-medium text-pandan/70">
                        Gallery
                    </p>
                    <h1 className="max-w-[16ch] font-display text-[clamp(2.25rem,1.6rem+3vw,4rem)] leading-[1] font-bold tracking-tight">
                        The shop, plate by plate.
                    </h1>
                </div>
            </section>

            <div className="wrapper py-12 md:py-16">
                {photos.length === 0 ? (
                    <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-8">
                        <p className="text-lg">
                            No photos here yet. The kitchen is busier than the
                            camera.
                        </p>
                        <Button
                            asChild
                            className="min-h-12 rounded-full px-6 text-base"
                        >
                            <Link to="/menu">See the menu instead</Link>
                        </Button>
                    </div>
                ) : (
                    <ul className="grid grid-flow-row-dense grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                        {photos.map((photo, index) => (
                            <li
                                key={photo.id}
                                className={cn(
                                    isFeature(index) &&
                                        'md:col-span-2 md:row-span-2',
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => setOpenIndex(index)}
                                    className="group block w-full cursor-zoom-in overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-dahon focus-visible:ring-offset-2 focus-visible:outline-none"
                                >
                                    <Tile
                                        photo={photo}
                                        wide={isFeature(index)}
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Dialog
                open={shown !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setOpenIndex(null);
                    }
                }}
            >
                <DialogContent
                    onKeyDown={handleKeys}
                    className="max-w-[min(100%-2rem,42rem)] gap-3 bg-uling p-3 text-pandan sm:max-w-[min(100%-2rem,42rem)]"
                >
                    <DialogTitle className="sr-only">
                        {shown?.caption ??
                            `Photo ${(openIndex ?? 0) + 1} of ${photos.length}`}
                    </DialogTitle>

                    {shown && (
                        <img
                            src={shown.image.md}
                            alt={shown.caption ?? ''}
                            width={800}
                            height={800}
                            className="w-full rounded-lg object-cover"
                        />
                    )}

                    <div className="flex items-center justify-between gap-3 pr-8">
                        <p className="min-h-6 text-sm text-pandan/80">
                            {shown?.caption}
                        </p>

                        {photos.length > 1 && (
                            <div className="flex shrink-0 gap-1">
                                <button
                                    type="button"
                                    aria-label="Previous photo"
                                    onClick={() => step(-1)}
                                    className="flex size-11 items-center justify-center rounded-full hover:bg-pandan/15"
                                >
                                    <ChevronLeft aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Next photo"
                                    onClick={() => step(1)}
                                    className="flex size-11 items-center justify-center rounded-full hover:bg-pandan/15"
                                >
                                    <ChevronRight aria-hidden="true" />
                                </button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function Tile({ photo, wide }: { photo: GalleryPhoto; wide: boolean }) {
    return (
        <figure className="relative">
            <img
                src={wide ? photo.image.md : photo.image.sm}
                alt={photo.caption ?? ''}
                width={wide ? 800 : 400}
                height={wide ? 800 : 400}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />

            {photo.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-uling/85 to-transparent p-3 text-left text-sm text-pandan">
                    {photo.caption}
                </figcaption>
            )}
        </figure>
    );
}
