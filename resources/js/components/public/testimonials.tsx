import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import { cn } from '@/lib/utils';

/** How long one quote holds the section before the next one comes up. */
const TURN_MS = 7000;

/** The brand's own colours, so one avatar never looks like the next. */
const avatarTones = [
    'bg-kalamansi text-uling',
    'bg-ube text-pandan',
    'bg-kawayan text-uling',
    'bg-achuete text-white',
];

function Avatar({
    name,
    avatar,
    tone,
}: {
    name: string;
    avatar?: string;
    tone: string;
}) {
    if (avatar !== undefined) {
        return (
            <img
                src={avatar}
                alt=""
                width={96}
                height={96}
                loading="lazy"
                className="size-20 shrink-0 rounded-full object-cover ring-2 ring-pandan/25 md:size-24"
            />
        );
    }

    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex size-20 shrink-0 items-center justify-center rounded-full font-display text-3xl font-bold ring-2 ring-pandan/25 md:size-24',
                tone,
            )}
        >
            {name.charAt(0)}
        </span>
    );
}

/**
 * What customers said, one at a time. The lines live in
 * `content/restaurant.ts` and are the shop's to keep true.
 */
export function Testimonials() {
    const entries = restaurant.testimonials;
    const [shown, setShown] = useState(0);
    const [paused, setPaused] = useState(false);

    const index = entries.length === 0 ? 0 : shown % entries.length;
    const entry = entries[index];

    // It moves on by itself, unless somebody is reading or asked for less motion.
    useEffect(() => {
        if (
            entries.length < 2 ||
            paused ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            return;
        }

        const timer = window.setInterval(
            () => setShown((current) => current + 1),
            TURN_MS,
        );

        return () => window.clearInterval(timer);
    }, [entries.length, paused]);

    if (entry === undefined) {
        return null;
    }

    return (
        <section
            id="testimonials"
            aria-labelledby="testimonials-heading"
            className="scroll-mt-[var(--header-h)] border-t border-border bg-dahon text-pandan"
        >
            <div
                className="wrapper flex flex-col items-center gap-8 py-16 md:py-24"
                onPointerEnter={() => setPaused(true)}
                onPointerLeave={() => setPaused(false)}
                onFocusCapture={() => setPaused(true)}
                onBlurCapture={() => setPaused(false)}
            >
                <h2
                    id="testimonials-heading"
                    className="font-display text-3xl font-bold tracking-tight md:text-4xl"
                >
                    What people say
                </h2>

                <figure
                    key={entry.quote}
                    className="quote-in flex max-w-[52ch] flex-col items-center gap-6 text-center"
                >
                    <Quote
                        aria-hidden="true"
                        className="size-7 text-pandan/40"
                    />

                    <blockquote className="text-[clamp(1.125rem,0.95rem+0.8vw,1.5rem)] leading-snug text-balance">
                        {entry.quote}
                    </blockquote>

                    <figcaption className="flex items-center gap-3">
                        <Avatar
                            name={entry.name}
                            avatar={entry.avatar}
                            tone={avatarTones[index % avatarTones.length]}
                        />
                        <span className="flex flex-col text-left">
                            <span className="font-semibold">{entry.name}</span>
                            <span className="text-sm text-pandan/70">
                                {entry.note}
                            </span>
                        </span>
                    </figcaption>
                </figure>

                {entries.length > 1 && (
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Previous"
                            className="size-11 rounded-full text-pandan hover:bg-pandan/15 hover:text-pandan"
                            onClick={() =>
                                setShown(
                                    (current) => current + entries.length - 1,
                                )
                            }
                        >
                            <ChevronLeft aria-hidden="true" />
                        </Button>

                        <div
                            role="group"
                            aria-label="Choose a quote"
                            className="flex"
                        >
                            {entries.map((choice, position) => (
                                <button
                                    key={choice.quote}
                                    type="button"
                                    aria-label={`Quote from ${choice.name}`}
                                    aria-current={
                                        position === index ? 'true' : undefined
                                    }
                                    onClick={() => setShown(position)}
                                    className="flex size-11 items-center justify-center"
                                >
                                    <span
                                        className={cn(
                                            'size-2.5 rounded-full border border-pandan/60',
                                            position === index && 'bg-pandan',
                                        )}
                                    />
                                </button>
                            ))}
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Next"
                            className="size-11 rounded-full text-pandan hover:bg-pandan/15 hover:text-pandan"
                            onClick={() => setShown((current) => current + 1)}
                        >
                            <ChevronRight aria-hidden="true" />
                        </Button>
                    </div>
                )}
            </div>
        </section>
    );
}
