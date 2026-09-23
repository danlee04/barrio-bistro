import { useEffect } from 'react';
import { useLocation, useRouteLoaderData } from 'react-router';
import { Hero } from '@/components/public/hero';
import { OpenStatus } from '@/components/public/open-status';
import { Button } from '@/components/ui/button';
import { dayNames, restaurant } from '@/content/restaurant';
import { featuredItems, type publicMenuLoader } from '@/lib/public-menu';
import { dayPart, formatClock } from '@/lib/restaurant-time';

const heroPhrase = {
    morning: 'this morning',
    afternoon: 'this afternoon',
    tonight: 'tonight',
};

/** Monday first, the way people read opening hours. */
const weekOrder = [1, 2, 3, 4, 5, 6, 0];

export default function Home() {
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('public') ?? [];
    const plates = featuredItems(categories);
    const phrase = heroPhrase[dayPart(new Date(), restaurant.timeZone)];
    const location = useLocation();

    useEffect(() => {
        if (location.hash === '#story' || location.hash === '#visit') {
            document
                .getElementById(location.hash.slice(1))
                ?.scrollIntoView({ block: 'start' });
        }
    }, [location.hash]);

    return (
        <>
            <title>{restaurant.name}</title>
            <meta
                name="description"
                content="Filipino neighbourhood cooking. See what is on the stove today and order from your table."
            />

            <Hero plates={plates} phrase={phrase} />

            <section
                id="story"
                aria-labelledby="story-heading"
                className="scroll-mt-4"
            >
                <div className="wrapper flex flex-col gap-5 py-16 md:py-20">
                    <h2
                        id="story-heading"
                        className="font-display text-4xl font-bold tracking-tight"
                    >
                        Our story
                    </h2>
                    {restaurant.story.map((paragraph) => (
                        <p
                            key={paragraph}
                            className="max-w-[65ch] text-lg leading-relaxed"
                        >
                            {paragraph}
                        </p>
                    ))}
                </div>
            </section>

            <section
                id="visit"
                aria-labelledby="visit-heading"
                className="scroll-mt-4 border-t border-border"
            >
                <div className="wrapper grid gap-10 py-16 md:grid-cols-2 md:py-20">
                    <div className="flex flex-col gap-5">
                        <h2
                            id="visit-heading"
                            className="font-display text-4xl font-bold tracking-tight"
                        >
                            Visit
                        </h2>
                        <OpenStatus />
                        <address className="text-lg leading-relaxed not-italic">
                            {restaurant.addressLines.map((line) => (
                                <span key={line} className="block">
                                    {line}
                                </span>
                            ))}
                        </address>
                        <p className="text-lg">
                            <a
                                href={`tel:${restaurant.phone.tel}`}
                                className="underline underline-offset-4"
                            >
                                {restaurant.phone.display}
                            </a>
                        </p>
                        <Button
                            asChild
                            variant="secondary"
                            size="lg"
                            className="min-h-11 w-fit text-base"
                        >
                            <a
                                href={restaurant.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open in Google Maps
                            </a>
                        </Button>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h3 className="font-display text-2xl font-bold">
                            Opening hours
                        </h3>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-lg">
                            {weekOrder.map((day) => {
                                const hours = restaurant.hours.find(
                                    (entry) => entry.day === day,
                                );

                                return (
                                    <div key={day} className="contents">
                                        <dt className="font-medium">
                                            {dayNames[day]}
                                        </dt>
                                        <dd>
                                            {hours
                                                ? `${formatClock(hours.opens)} to ${formatClock(hours.closes)}`
                                                : 'Closed'}
                                        </dd>
                                    </div>
                                );
                            })}
                        </dl>
                    </div>
                </div>
            </section>
        </>
    );
}
