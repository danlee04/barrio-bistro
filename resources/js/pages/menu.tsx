import { useRouteLoaderData, useSearchParams } from 'react-router';
import { MenuCard } from '@/components/public/menu-card';
import { restaurant } from '@/content/restaurant';
import type { publicMenuLoader } from '@/lib/public-menu';
import { cn } from '@/lib/utils';

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
                content="The full Barrio Bistro menu with prices, updated as dishes sell out."
            />

            <div className="wrapper pt-10 md:pt-14">
                <h1 className="font-display text-[clamp(2.5rem,1.9rem+3vw,4.5rem)] leading-none font-bold tracking-tight">
                    Menu
                </h1>
            </div>

            {categories.length === 0 ? (
                <p className="wrapper py-10 text-lg">
                    Today's menu is being prepared. Check back soon.
                </p>
            ) : (
                <>
                    <nav
                        aria-label="Categories"
                        className="sticky top-0 z-10 mt-6 border-b border-border bg-pandan/95 backdrop-blur"
                    >
                        <ul className="wrapper flex gap-2 overflow-x-auto overscroll-x-contain py-3">
                            <li className="shrink-0">
                                <button
                                    type="button"
                                    aria-pressed={active === null}
                                    onClick={() => choose(null)}
                                    className={cn(
                                        'inline-flex min-h-11 items-center rounded-full border border-dahon px-4 font-medium',
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
                                            'inline-flex min-h-11 items-center rounded-full border border-dahon px-4 font-medium',
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

                    <div className="wrapper flex flex-col gap-12 py-10 md:py-14">
                        {shown.map((category) => (
                            <section
                                key={category.id}
                                aria-labelledby={`${category.slug}-heading`}
                                className="flex flex-col gap-5"
                            >
                                <div className="flex flex-col gap-1">
                                    <h2
                                        id={`${category.slug}-heading`}
                                        className="font-display text-3xl font-bold tracking-tight md:text-4xl"
                                    >
                                        {category.name}
                                    </h2>
                                    {category.description && (
                                        <p className="max-w-[65ch] text-muted-foreground">
                                            {category.description}
                                        </p>
                                    )}
                                </div>

                                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {category.items.map((item) => (
                                        <MenuCard key={item.id} item={item} />
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}
