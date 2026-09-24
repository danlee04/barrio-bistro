import { Link } from 'react-router';
import { Hero } from '@/components/public/hero';
import { OpenStatus } from '@/components/public/open-status';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import { featuredItems, type publicMenuLoader } from '@/lib/public-menu';
import { dayPart } from '@/lib/restaurant-time';
import { useRouteLoaderData } from 'react-router';

const heroPhrase = {
    morning: 'this morning',
    afternoon: 'this afternoon',
    tonight: 'tonight',
};

const offers = [
    {
        title: 'Dine in',
        body: 'Order at the counter, take a number, and we bring it to your table.',
    },
    {
        title: 'Take out',
        body: 'Say the word at checkout and the kitchen packs it for the road.',
    },
    {
        title: 'Bulk orders',
        body: 'Feeding a party or an office? Tell us the date and the headcount.',
    },
];

export default function Home() {
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('public') ?? [];
    const plates = featuredItems(categories);
    const phrase = heroPhrase[dayPart(new Date(), restaurant.timeZone)];

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
                                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5"
                            >
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

            <section
                aria-labelledby="story-heading"
                className="border-t border-border"
            >
                <div className="wrapper flex flex-col items-start gap-5 py-14 md:py-20">
                    <h2
                        id="story-heading"
                        className="font-display text-3xl font-bold tracking-tight md:text-4xl"
                    >
                        Our story
                    </h2>
                    <p className="max-w-[68ch] text-lg leading-relaxed">
                        {restaurant.story[0]}
                    </p>
                    <Link
                        to="/about"
                        className="text-lg underline underline-offset-4"
                    >
                        Read the whole story
                    </Link>
                </div>
            </section>

            <section
                aria-labelledby="visit-heading"
                className="border-t border-border"
            >
                <div className="wrapper flex flex-col items-start gap-4 py-14 md:py-20">
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
            </section>
        </>
    );
}
