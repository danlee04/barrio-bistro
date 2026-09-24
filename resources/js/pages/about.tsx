import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';

export default function About() {
    return (
        <>
            <title>{`About | ${restaurant.name}`}</title>
            <meta
                name="description"
                content="How Barrio Bistro started, and what comes out of its kitchen."
            />

            <section className="bg-dahon text-pandan">
                <div className="wrapper flex flex-col gap-4 py-12 md:py-16">
                    <p className="text-sm font-medium text-pandan/70">
                        Our story
                    </p>
                    <h1 className="max-w-[16ch] font-display text-[clamp(2.25rem,1.6rem+3vw,4rem)] leading-[1] font-bold tracking-tight">
                        Cooked the way a neighbour cooks.
                    </h1>
                </div>
            </section>

            <div className="wrapper flex flex-col gap-6 py-12 md:py-16">
                {restaurant.story.map((paragraph) => (
                    <p
                        key={paragraph}
                        className="max-w-[68ch] text-lg leading-relaxed"
                    >
                        {paragraph}
                    </p>
                ))}

                <div className="flex flex-wrap gap-3 pt-4">
                    <Button
                        asChild
                        size="lg"
                        className="min-h-12 rounded-full px-6 text-base"
                    >
                        <Link to="/menu">See the menu</Link>
                    </Button>
                    <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="min-h-12 rounded-full px-6 text-base"
                    >
                        <Link to="/contact">Visit us</Link>
                    </Button>
                </div>
            </div>
        </>
    );
}
