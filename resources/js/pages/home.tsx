import { ShoppingBag, UtensilsCrossed, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation, useRouteLoaderData } from 'react-router';
import { Hero } from '@/components/public/hero';
import { OpenStatus } from '@/components/public/open-status';
import { Photo } from '@/components/public/photo';
import { Plate } from '@/components/public/plate';
import { PriceList } from '@/components/public/price-list';
import { Testimonials } from '@/components/public/testimonials';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import { featuredItems, type publicMenuLoader } from '@/lib/public-menu';
import { dayPart } from '@/lib/restaurant-time';

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
    },
    {
        icon: ShoppingBag,
        title: 'Take out',
        body: 'Say the word at checkout and the kitchen packs it for the road.',
    },
    {
        icon: Users,
        title: 'Bulk orders',
        body: 'Feeding a party or an office? Tell us the date and the headcount.',
    },
];

export default function Home() {
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('public') ?? [];
    const plates = featuredItems(categories);
    const phrase = heroPhrase[dayPart(new Date(), restaurant.timeZone)];
    const { hash } = useLocation();

    // A link like /#testimonials should land on the section, not the top.
    useEffect(() => {
        if (hash === '') {
            return;
        }

        document
            .getElementById(hash.slice(1))
            ?.scrollIntoView({ block: 'start' });
    }, [hash]);

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

                    <ul className="grid gap-4 md:grid-cols-3">
                        {offers.map((offer) => (
                            <li
                                key={offer.title}
                                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
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
                    <div className="wrapper flex flex-col gap-6 py-14 md:py-20">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <h2
                                id="cooking-heading"
                                className="font-display text-3xl font-bold tracking-tight md:text-4xl"
                            >
                                Cooking today
                            </h2>
                            <Link
                                to="/menu"
                                className="text-lg underline underline-offset-4"
                            >
                                See the whole menu
                            </Link>
                        </div>

                        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {plates.slice(0, 4).map((item) => (
                                <li
                                    key={item.id}
                                    className="flex flex-col items-center gap-3 text-center"
                                >
                                    <Plate item={item} size="menu" />
                                    <p className="font-semibold">{item.name}</p>
                                    <PriceList
                                        sizes={item.sizes}
                                        className="justify-center text-sm"
                                    />
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
                    <Photo
                        src={restaurant.photos.story}
                        alt="The kitchen at work"
                        className="aspect-4/3 w-full rounded-xl"
                    />

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
                            className="text-lg underline underline-offset-4"
                        >
                            Read the whole story
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

                    <Photo
                        src={restaurant.photos.interior}
                        alt="Inside the shop"
                        className="aspect-4/3 w-full rounded-xl md:order-1"
                    />
                </div>
            </section>
        </>
    );
}
