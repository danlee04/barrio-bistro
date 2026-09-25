import { Link } from 'react-router';
import { Photo } from '@/components/public/photo';
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

            <div className="wrapper grid items-start gap-8 py-12 md:grid-cols-[1fr_20rem] md:gap-12 md:py-16">
                <div className="flex flex-col gap-6">
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

                <Photo
                    src={restaurant.photos.story}
                    alt="The kitchen at work"
                    className="aspect-4/5 w-full rounded-2xl shadow-xl ring-1 ring-uling/10 md:sticky md:top-[calc(var(--header-h)+1.5rem)]"
                />
            </div>
        </>
    );
}
