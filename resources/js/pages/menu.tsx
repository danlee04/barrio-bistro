import { Link, useRouteLoaderData, useSearchParams } from 'react-router';
import { DishCard } from '@/components/public/dish-card';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import type { publicMenuLoader } from '@/lib/public-menu';
import { cn } from '@/lib/utils';

/** The menu to read. Ordering happens at the till, under /order. */
export default function Menu() {
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('public') ?? [];
    const [searchParams, setSearchParams] = useSearchParams();

    const chosen = searchParams.get('c');
    const known = categories.some((category) => category.slug === chosen);
    const active = known ? chosen : null;

    const shown =
        active === null
            ? categories
            : categories.filter((category) => category.slug === active);

    /** Keep the chosen category in the address, so Back and refresh behave. */
    function choose(slug: string | null) {
        const next = new URLSearchParams(searchParams);

        if (slug === null) {
            next.delete('c');
        } else {
            next.set('c', slug);
        }

        setSearchParams(next);
    }

    return (
        <>
            <title>{`Menu | ${restaurant.name}`}</title>
            <meta
                name="description"
                content="Everything Barrio Bistro cooks, dish by dish, updated as things sell out."
            />

            <div className="wrapper flex flex-wrap items-end justify-between gap-4 pt-10 md:pt-14">
                <div className="flex flex-col gap-2">
                    <h1 className="font-display text-[clamp(1.75rem,1.5rem+1.2vw,2.5rem)] leading-none font-bold tracking-tight">
                        Menu
                    </h1>
                    <p className="max-w-[56ch] text-sm text-muted-foreground">
                        Everything the kitchen cooks. Prices are on the order
                        screen, where you can act on them.
                    </p>
                </div>

                <Button
                    asChild
                    size="lg"
                    className="min-h-12 rounded-full px-6 text-base"
                >
                    <Link to="/order">Order now</Link>
                </Button>
            </div>

            {categories.length === 0 ? (
                <p className="wrapper py-10 text-lg">
                    Today's menu is being prepared. Check back soon.
                </p>
            ) : (
                <>
                    <nav
                        aria-label="Categories"
                        className="sticky top-[var(--header-h)] z-10 mt-6 border-b border-border bg-pandan/95 backdrop-blur"
                    >
                        <ul className="wrapper flex gap-2 overflow-x-auto overscroll-x-contain py-2.5">
                            <li className="shrink-0">
                                <button
                                    type="button"
                                    aria-pressed={active === null}
                                    onClick={() => choose(null)}
                                    className={cn(
                                        'inline-flex min-h-9 items-center rounded-full border border-dahon px-3 text-sm font-medium',
                                        active === null
                                            ? 'bg-dahon text-pandan'
                                            : 'text-dahon hover:bg-dahon/10',
                                    )}
                                >
                                    All
                                </button>
                            </li>

                            {categories.map((category) => (
                                <li key={category.id} className="shrink-0">
                                    <button
                                        type="button"
                                        aria-pressed={active === category.slug}
                                        onClick={() => choose(category.slug)}
                                        className={cn(
                                            'inline-flex min-h-9 items-center rounded-full border border-dahon px-3 text-sm font-medium',
                                            active === category.slug
                                                ? 'bg-dahon text-pandan'
                                                : 'text-dahon hover:bg-dahon/10',
                                        )}
                                    >
                                        {category.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="wrapper flex flex-col gap-10 py-10 md:py-14">
                        {shown.map((category) => (
                            <section
                                key={category.id}
                                aria-labelledby={`${category.slug}-heading`}
                                className="flex flex-col gap-2"
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-4">
                                        <h2
                                            id={`${category.slug}-heading`}
                                            className="font-display text-xl font-bold tracking-tight md:text-2xl"
                                        >
                                            {category.name}
                                        </h2>
                                        <span
                                            aria-hidden="true"
                                            className="h-px flex-1 bg-kawayan/50"
                                        />
                                    </div>
                                    {category.description && (
                                        <p className="max-w-[65ch] text-muted-foreground">
                                            {category.description}
                                        </p>
                                    )}
                                </div>

                                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                    {category.items.map((item) => (
                                        <DishCard key={item.id} item={item} />
                                    ))}
                                </ul>
                            </section>
                        ))}

                        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
                            <p className="font-display text-xl font-bold">
                                Hungry now?
                            </p>
                            <p className="text-muted-foreground">
                                Order at the counter or from your phone — the
                                kitchen starts once it is paid.
                            </p>
                            <Button
                                asChild
                                size="lg"
                                className="min-h-12 rounded-full px-6 text-base"
                            >
                                <Link to="/order">Order now</Link>
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
