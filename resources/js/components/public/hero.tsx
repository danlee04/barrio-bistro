import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { OpenStatus } from '@/components/public/open-status';
import { Photo } from '@/components/public/photo';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

const ROTATE_MS = 6000;

/** How many dishes fit down the side of the big one. */
const SIDES = 4;

type HeroProps = {
    plates: MenuItem[];
    /** "this morning", "this afternoon" or "tonight". */
    phrase: string;
};

/** A dish photo, or its first letter when the shop has not uploaded one yet. */
function DishFrame({ item, big = false }: { item: MenuItem; big?: boolean }) {
    if (item.image === null) {
        return (
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-full items-center justify-center bg-dahon font-display font-bold text-pandan/40',
                    big ? 'text-7xl' : 'text-2xl',
                )}
            >
                {item.name.charAt(0)}
            </span>
        );
    }

    return (
        <img
            src={item.image.md}
            srcSet={`${item.image.sm} 400w, ${item.image.md} 800w`}
            sizes={big ? '(min-width: 768px) 24rem, 60vw' : '5rem'}
            alt=""
            width={800}
            height={800}
            loading={big ? 'eager' : 'lazy'}
            fetchPriority={big ? 'high' : 'auto'}
            decoding="async"
            className="size-full object-cover"
        />
    );
}

/**
 * The first thing a visitor sees: the room itself behind the words, and what is
 * actually cooking today in front of them — one dish held large, the rest down
 * its side. The small ones are the picker, so nothing decorative is added to
 * do a job the photos already do.
 */
export function Hero({ plates, phrase }: HeroProps) {
    const [chosen, setChosen] = useState(0);
    const index = plates.length === 0 ? 0 : chosen % plates.length;
    const featured = plates[index] ?? null;
    const sides = plates.slice(0, SIDES);

    // The plate changes by itself, unless the guest asked for less motion.
    useEffect(() => {
        if (
            plates.length < 2 ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            return;
        }

        const timer = window.setInterval(
            () => setChosen((current) => current + 1),
            ROTATE_MS,
        );

        return () => window.clearInterval(timer);
    }, [plates.length]);

    return (
        <section className="relative overflow-hidden bg-dahon text-pandan">
            <Photo
                src={restaurant.photos.hero}
                alt=""
                priority
                className="absolute inset-0 size-full"
            />
            {/* Dark enough to read on, light enough to see the room through. */}
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-dahon/75 md:bg-linear-to-r md:from-dahon/95 md:via-dahon/80 md:to-dahon/55"
            />

            <div className="relative">
                <div className="wrapper grid items-center gap-10 pt-12 pb-10 md:grid-cols-[1.05fr_1fr] md:gap-8 md:pt-16">
                    <div className="flex flex-col items-start gap-5">
                        <p className="text-sm font-medium text-pandan/70">
                            {restaurant.tagline}
                        </p>

                        <h1 className="font-display text-[clamp(2.75rem,1.75rem+5vw,6rem)] leading-[0.95] font-bold tracking-tight text-balance">
                            On the stove {phrase}.
                        </h1>

                        <p className="line-clamp-3 max-w-[46ch] text-pandan/80 md:text-lg">
                            {restaurant.story[0]}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-3">
                            <Button
                                asChild
                                size="lg"
                                className="min-h-14 rounded-full px-8 text-base"
                            >
                                <Link to="/order">Order now</Link>
                            </Button>
                            <Button
                                asChild
                                size="lg"
                                className="min-h-14 rounded-full bg-white px-8 text-base text-dahon hover:bg-pandan"
                            >
                                <Link to="/menu">See the menu</Link>
                            </Button>
                        </div>
                    </div>

                    {featured !== null && (
                        <div className="flex items-stretch gap-3 md:justify-self-end">
                            <figure className="flex min-w-0 flex-1 flex-col gap-3 md:w-96 md:flex-none">
                                <div
                                    key={featured.id}
                                    className="serve aspect-4/5 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-pandan/25"
                                >
                                    <DishFrame item={featured} big />
                                </div>

                                <figcaption className="font-display text-lg font-semibold">
                                    {featured.name}
                                </figcaption>
                            </figure>

                            {sides.length > 1 && (
                                <ul
                                    aria-label="Choose a dish"
                                    className="flex shrink-0 flex-col gap-3"
                                >
                                    {sides.map((item, position) => (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                aria-label={`Show ${item.name}`}
                                                aria-current={
                                                    position === index
                                                        ? 'true'
                                                        : undefined
                                                }
                                                onClick={() =>
                                                    setChosen(position)
                                                }
                                                className={cn(
                                                    'size-16 overflow-hidden rounded-xl transition md:size-20',
                                                    position === index
                                                        ? 'ring-2 ring-pandan'
                                                        : 'opacity-65 ring-1 ring-pandan/30 hover:opacity-100',
                                                )}
                                            >
                                                <DishFrame item={item} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                <div className="wrapper pb-10">
                    <OpenStatus className="text-sm" />
                </div>
            </div>
        </section>
    );
}
