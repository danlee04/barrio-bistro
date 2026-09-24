import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { OpenStatus } from '@/components/public/open-status';
import { Photo } from '@/components/public/photo';
import { Plate } from '@/components/public/plate';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

const ROTATE_MS = 6000;

type HeroProps = {
    plates: MenuItem[];
    /** "this morning", "this afternoon" or "tonight". */
    phrase: string;
};

/**
 * The first thing a visitor sees: the room itself behind the words, and what is
 * actually cooking today in front of them.
 */
export function Hero({ plates, phrase }: HeroProps) {
    const [chosen, setChosen] = useState(0);
    const index = plates.length === 0 ? 0 : chosen % plates.length;
    const featured = plates[index] ?? null;

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
                className="absolute inset-0 bg-dahon/70 md:bg-linear-to-r md:from-dahon/95 md:via-dahon/75 md:to-dahon/25"
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
                                variant="secondary"
                                size="lg"
                                className="min-h-14 rounded-full px-8 text-base"
                            >
                                <Link to="/menu">See the menu</Link>
                            </Button>
                        </div>
                    </div>

                    {featured !== null && (
                        <figure
                            key={featured.id}
                            className="serve flex flex-col items-center gap-4 justify-self-center md:justify-self-end"
                        >
                            <Plate item={featured} size="feature" priority />

                            <figcaption className="flex flex-col items-center gap-1 text-center">
                                <p className="text-lg font-semibold">
                                    {featured.name}
                                </p>
                            </figcaption>
                        </figure>
                    )}
                </div>

                <div className="wrapper flex flex-wrap items-center justify-between gap-4 pb-10">
                    {plates.length > 0 && (
                        <div className="flex items-center gap-3">
                            <ul aria-hidden="true" className="flex -space-x-3">
                                {plates.slice(0, 4).map((item) => (
                                    <li key={item.id}>
                                        <Plate item={item} size="chip" />
                                    </li>
                                ))}
                            </ul>

                            <OpenStatus className="text-sm" />
                        </div>
                    )}

                    {plates.length > 1 && (
                        <div
                            role="group"
                            aria-label="Choose a dish"
                            className="flex"
                        >
                            {plates.map((item, position) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    aria-label={`Show ${item.name}`}
                                    aria-current={
                                        position === index ? 'true' : undefined
                                    }
                                    onClick={() => setChosen(position)}
                                    className="flex size-11 items-center justify-center"
                                >
                                    <span
                                        className={cn(
                                            'size-3 rounded-full border border-pandan/60',
                                            position === index && 'bg-pandan',
                                        )}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
