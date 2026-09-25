import { ArrowRight, ShoppingBag, UtensilsCrossed, Users } from 'lucide-react';
import { Link, useRouteLoaderData } from 'react-router';
import { Hero } from '@/components/public/hero';
import { OpenStatus } from '@/components/public/open-status';
import { Photo } from '@/components/public/photo';
import { Plate } from '@/components/public/plate';
import { Testimonials } from '@/components/public/testimonials';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import { useHashScroll } from '@/lib/hash-scroll';
import { tiltFor } from '@/lib/pinned';
import { featuredItems, type publicMenuLoader } from '@/lib/public-menu';
import { dayPart } from '@/lib/restaurant-time';
import { cn } from '@/lib/utils';

const heroPhrase = {
    morning: 'this morning',
    afternoon: 'this afternoon',
    tonight: 'tonight',
};

const offers = [
    {
        icon: UtensilsCrossed,
        title: 'Dine in',
        body: 'Order at the counter, take a number, and we bring it to your table.',
        to: null,
    },
    {
        icon: ShoppingBag,
        title: 'Take out',
        body: 'Say the word at checkout and the kitchen packs it for the road.',
        to: null,
    },
    {
        icon: Users,
        title: 'Bulk orders',
        body: 'Feeding a party or an office? Tell us the date and the headcount.',
        to: '/offers#bulk',
    },
];

export default function Home() {
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('public') ?? [];
    const plates = featuredItems(categories);
    const phrase = heroPhrase[dayPart(new Date(), restaurant.timeZone)];

    useHashScroll();

    return (
        <>
            <title>{restaurant.name}</title>
            <meta
                name="description"
                content="Filipino neighbourhood cooking. See what is on the stove today and order from your table."
            />

            <Hero plates={plates} phrase={phrase} />

            <section aria-labelledby="offers-heading">
                <div className="wrapper flex flex-col gap-6 py-14 md:py-20">
                    <h2
                        id="offers-heading"
                        className="font-display text-3xl font-bold tracking-tight md:text-4xl"
                    >
                        What we serve
                    </h2>

                    <ul className="grid gap-6 md:grid-cols-3">
                        {offers.map((offer, index) => (
                            <li
                                key={offer.title}
                                className={cn(
                                    'pinned flex flex-col gap-3 p-6 pt-9',
                                    tiltFor(index),
                                )}
                            >
                                <offer.icon
                                    aria-hidden="true"
                                    className="size-7 text-dahon"
                                />
                                <h3 className="font-display text-xl font-bold">
                                    {offer.title}
                                </h3>
                                <p className="text-muted-foreground">
                                    {offer.body}
                                </p>
                                {offer.to !== null && (
                                    <Link
                                        to={offer.to}
                                        className="group mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-dahon"
                                    >
                                        Ask about a bulk order
                                        <ArrowRight
                                            aria-hidden="true"
                                            className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                                        />
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {plates.length > 0 && (
                <section
                    aria-labelledby="cooking-heading"
                    className="border-t border-border bg-card"
                >
                    <div className="wrapper flex flex-col gap-10 py-14 md:py-20">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div className="flex flex-col gap-2">
                                <h2
                                    id="cooking-heading"
                                    className="font-display text-3xl font-bold tracking-tight md:text-4xl"
                                >
                                    Cooking today
                                </h2>
                                <p className="max-w-[52ch] text-muted-foreground">
                                    What the kitchen has on right now. Prices
                                    are on the order screen.
                                </p>
                            </div>
                            <Link
                                to="/menu"
                                aria-label="See all dishes on the menu"
                                className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-dahon"
                            >
                                See all
                                <ArrowRight
                                    aria-hidden="true"
                                    className="size-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                                />
                            </Link>
                        </div>

                        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
                            {plates.slice(0, 4).map((item) => (
                                <li
                                    key={item.id}
                                    className="reach flex flex-col items-center gap-4 text-center"
                                >
                                    <Plate item={item} size="hero" />

                                    <div className="flex flex-col gap-1">
                                        <p className="font-display text-lg leading-snug font-bold text-balance">
                                            {item.name}
                                        </p>
                                        {item.description && (
                                            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            )}

            <section
                aria-labelledby="story-heading"
                className="border-t border-border"
            >
                <div className="wrapper grid items-center gap-8 py-14 md:grid-cols-2 md:gap-12 md:py-20">
                    {/* The big one on the table, two smaller ones laid across
                        its corners the way photos land in a pile. */}
                    <div className="relative mx-auto w-full max-w-sm p-6 md:mx-0 md:max-w-md">
                        <Photo
                            src={restaurant.photos.story}
                            alt="The kitchen at work"
                            className="aspect-4/5 w-full rounded-2xl shadow-xl ring-1 ring-uling/10"
                        />

                        <Photo
                            src={restaurant.photos.kitchen}
                            alt=""
                            className="absolute bottom-0 left-0 aspect-square w-28 -rotate-6 rounded-xl shadow-lg ring-4 ring-pandan md:w-36"
                        />

                        <Photo
                            src={restaurant.photos.counter}
                            alt=""
                            className="absolute top-0 right-0 aspect-square w-24 rotate-6 rounded-xl shadow-lg ring-4 ring-pandan md:w-32"
                        />
                    </div>

                    <div className="flex flex-col items-start gap-5">
                        <h2
                            id="story-heading"
                            className="font-display text-3xl font-bold tracking-tight md:text-4xl"
                        >
                            Our story
                        </h2>
                        <p className="max-w-[60ch] text-lg leading-relaxed">
                            {restaurant.story[0]}
                        </p>
                        <Link
                            to="/about"
                            className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-dahon"
                        >
                            Read the whole story
                            <ArrowRight
                                aria-hidden="true"
                                className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                            />
                        </Link>
                    </div>
                </div>
            </section>

            <Testimonials />

            <section
                aria-labelledby="visit-heading"
                className="border-t border-border bg-card"
            >
                <div className="wrapper grid items-center gap-8 py-14 md:grid-cols-2 md:gap-12 md:py-20">
                    <div className="flex flex-col items-start gap-4 md:order-2">
                        <h2
                            id="visit-heading"
                            className="font-display text-3xl font-bold tracking-tight md:text-4xl"
                        >
                            Visit
                        </h2>

                        <OpenStatus className="text-lg" />

                        <address className="text-lg leading-relaxed not-italic">
                            {restaurant.addressLines.map((line) => (
                                <span key={line} className="block">
                                    {line}
                                </span>
                            ))}
                        </address>

                        <div className="flex flex-wrap gap-3 pt-2">
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
                                <Link to="/contact">Hours and directions</Link>
                            </Button>
                        </div>
                    </div>

                    {/* The same pile as the story, turned over: the small
                        ones land on the opposite corners. */}
                    <div className="relative mx-auto w-full max-w-sm p-6 md:order-1 md:mx-0 md:max-w-md">
                        <Photo
                            src={restaurant.photos.interior}
                            alt="Inside the shop"
                            className="aspect-4/5 w-full rounded-2xl shadow-xl ring-1 ring-uling/10"
                        />

                        <Photo
                            src={restaurant.photos.street}
                            alt=""
                            className="absolute top-0 left-0 aspect-square w-24 -rotate-6 rounded-xl shadow-lg ring-4 ring-card md:w-32"
                        />

                        <Photo
                            src={restaurant.photos.table}
                            alt=""
                            className="absolute right-0 bottom-0 aspect-square w-28 rotate-6 rounded-xl shadow-lg ring-4 ring-card md:w-36"
                        />
                    </div>
                </div>
            </section>
        </>
    );
}
