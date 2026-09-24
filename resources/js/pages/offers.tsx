import { Link } from 'react-router';
import { InquiryForm } from '@/components/public/inquiry-form';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import { useHashScroll } from '@/lib/hash-scroll';
import { tiltFor } from '@/lib/pinned';
import { cn } from '@/lib/utils';

const ways = [
    {
        title: 'Dine in',
        lead: 'Order at the counter, sit down, and we bring it out.',
        points: [
            'Tell us your name at checkout and we call it when the food is up.',
            'Pay at the counter in cash, or online at checkout when that is offered.',
        ],
    },
    {
        title: 'Take out',
        lead: 'Same menu, packed for the road.',
        points: [
            'Say take out at checkout and the kitchen packs it.',
            'Your order number is on the screen; show it at the counter.',
        ],
    },
    {
        title: 'Bulk orders and catering',
        lead: 'Parties, offices, handaan. Trays instead of plates.',
        points: [
            'Tell us the day and roughly how many people are eating.',
            'We come back with what fits and what it costs. Nothing is charged until you say yes.',
        ],
    },
];

export default function Offers() {
    useHashScroll();

    return (
        <>
            <title>{`What we offer | ${restaurant.name}`}</title>
            <meta
                name="description"
                content="Dine in, take out, or have Barrio Bistro cook for a party or an office."
            />

            <section className="bg-dahon text-pandan">
                <div className="wrapper flex flex-col gap-4 py-12 md:py-16">
                    <p className="text-sm font-medium text-pandan/70">
                        What we offer
                    </p>
                    <h1 className="max-w-[18ch] font-display text-[clamp(2.25rem,1.6rem+3vw,4rem)] leading-none font-bold tracking-tight">
                        Three ways to eat with us.
                    </h1>
                </div>
            </section>

            <div className="wrapper flex flex-col gap-12 py-12 md:py-16">
                <ul className="grid gap-6 md:grid-cols-3">
                    {ways.map((way, index) => (
                        <li
                            key={way.title}
                            className={cn(
                                'pinned flex flex-col gap-3 p-6 pt-9',
                                tiltFor(index),
                            )}
                        >
                            <h2 className="font-display text-2xl font-bold">
                                {way.title}
                            </h2>
                            <p className="text-lg">{way.lead}</p>
                            <ul className="flex flex-col gap-2 text-muted-foreground">
                                {way.points.map((point) => (
                                    <li key={point}>{point}</li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>

                <div className="flex flex-wrap gap-3">
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

                <div
                    id="bulk"
                    className="max-w-184 scroll-mt-[calc(var(--header-h)+1.5rem)] border-t border-border pt-12"
                >
                    <InquiryForm
                        type="bulk"
                        heading="Ask about a bulk order"
                        description="Tell us the day and the headcount. We will come back with what fits and what it costs."
                        messageLabel="What is the occasion, and what would you like?"
                        messagePlaceholder="Office Christmas party. Pancit, lechon kawali and rice, delivered by 11am if that is possible."
                    />
                </div>
            </div>
        </>
    );
}
