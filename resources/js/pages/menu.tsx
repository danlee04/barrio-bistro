import { useLoaderData } from 'react-router';
import { Plate } from '@/components/public/plate';
import { PriceList } from '@/components/public/price-list';
import { restaurant } from '@/content/restaurant';
import type { publicMenuLoader } from '@/lib/public-menu';

export default function Menu() {
    const categories = useLoaderData<typeof publicMenuLoader>();

    return (
        <>
            <title>{`Menu | ${restaurant.name}`}</title>
            <meta
                name="description"
                content="The full Barrio Bistro menu with prices, updated as dishes sell out."
            />

            <div className="wrapper pt-10 md:pt-14">
                <h1 className="font-display text-[clamp(2.5rem,1.9rem+3vw,4.5rem)] leading-none font-extrabold tracking-tight">
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
                        <ul className="wrapper flex gap-2 overflow-x-auto py-3">
                            {categories.map((category) => (
                                <li key={category.id} className="shrink-0">
                                    <a
                                        href={`#${category.slug}`}
                                        className="inline-flex min-h-11 items-center rounded-full border border-dahon px-4 font-medium text-dahon hover:bg-dahon hover:text-pandan"
                                    >
                                        {category.name}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="wrapper flex flex-col gap-14 py-10 md:py-14">
                        {categories.map((category) => (
                            <section
                                key={category.id}
                                id={category.slug}
                                aria-labelledby={`${category.slug}-heading`}
                                className="flex scroll-mt-20 flex-col gap-6"
                            >
                                <div className="flex flex-col gap-1">
                                    <h2
                                        id={`${category.slug}-heading`}
                                        className="font-display text-3xl font-extrabold tracking-tight md:text-4xl"
                                    >
                                        {category.name}
                                    </h2>
                                    {category.description && (
                                        <p className="max-w-[65ch] text-muted-foreground">
                                            {category.description}
                                        </p>
                                    )}
                                </div>

                                <ul className="grid gap-x-10 gap-y-8 md:grid-cols-2">
                                    {category.items.map((item) => (
                                        <li
                                            key={item.id}
                                            className="flex items-start gap-4"
                                        >
                                            <Plate item={item} size="menu" />
                                            <div className="flex min-w-0 flex-col gap-2">
                                                <h3 className="text-lg leading-snug font-semibold">
                                                    {item.name}
                                                </h3>
                                                {item.description && (
                                                    <p className="line-clamp-3 text-muted-foreground">
                                                        {item.description}
                                                    </p>
                                                )}
                                                {item.is_available ? (
                                                    <PriceList
                                                        sizes={item.sizes}
                                                    />
                                                ) : (
                                                    <p className="font-semibold text-achuete">
                                                        Sold out today
                                                    </p>
                                                )}
                                            </div>
                                        </li>
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
