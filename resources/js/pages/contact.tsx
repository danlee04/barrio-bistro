import { Link } from 'react-router';
import { OpenStatus } from '@/components/public/open-status';
import { Button } from '@/components/ui/button';
import { dayNames, restaurant } from '@/content/restaurant';
import { formatClock } from '@/lib/restaurant-time';

/** Monday first, the way people read opening hours. */
const weekOrder = [1, 2, 3, 4, 5, 6, 0];

export default function Contact() {
    return (
        <>
            <title>{`Contact | ${restaurant.name}`}</title>
            <meta
                name="description"
                content="Where Barrio Bistro is, when it is open, and how to reach it."
            />

            <div className="wrapper flex flex-col gap-8 py-12 md:py-16">
                <div className="flex flex-col gap-2">
                    <h1 className="font-display text-[clamp(2.25rem,1.6rem+3vw,4rem)] leading-none font-bold tracking-tight">
                        Visit
                    </h1>
                    <OpenStatus className="text-lg" />
                </div>

                <div className="grid gap-10 md:grid-cols-2">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <h2 className="font-display text-xl font-bold">
                                Where
                            </h2>
                            <address className="text-lg leading-relaxed not-italic">
                                {restaurant.addressLines.map((line) => (
                                    <span key={line} className="block">
                                        {line}
                                    </span>
                                ))}
                            </address>
                            <Button
                                asChild
                                variant="secondary"
                                size="lg"
                                className="min-h-12 w-fit rounded-full px-6 text-base"
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

                        <div className="flex flex-col gap-2">
                            <h2 className="font-display text-xl font-bold">
                                Reach us
                            </h2>
                            <p className="text-lg">
                                <a
                                    href={`tel:${restaurant.phone.tel}`}
                                    className="underline underline-offset-4"
                                >
                                    {restaurant.phone.display}
                                </a>
                            </p>
                            {restaurant.facebookUrl !== null && (
                                <p className="text-lg">
                                    <a
                                        href={restaurant.facebookUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline underline-offset-4"
                                    >
                                        Facebook
                                    </a>
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <h2 className="font-display text-xl font-bold">
                            Opening hours
                        </h2>
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

                <div className="flex flex-wrap gap-3 border-t border-border pt-8">
                    <Button
                        asChild
                        size="lg"
                        className="min-h-12 rounded-full px-6 text-base"
                    >
                        <Link to="/order">Order now</Link>
                    </Button>
                    <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="min-h-12 rounded-full px-6 text-base"
                    >
                        <Link to="/menu">See the menu</Link>
                    </Button>
                </div>
            </div>
        </>
    );
}
