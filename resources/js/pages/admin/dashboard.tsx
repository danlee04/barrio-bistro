import { useEffect, useState } from 'react';
import { useLoaderData } from 'react-router';
import { BusyHours } from '@/components/reports/busy-hours';
import { PaceCard } from '@/components/reports/pace-card';
import { SalesChart } from '@/components/reports/sales-chart';
import { StatTile } from '@/components/reports/stat-tile';
import { formatPeso } from '@/lib/money';
import { fetchReportSummary, type reportsLoader } from '@/lib/reports';

const REFRESH_MS = 60_000;

export default function Dashboard() {
    const initial = useLoaderData<typeof reportsLoader>();
    const [report, setReport] = useState(initial);

    useEffect(() => {
        setReport(initial);
    }, [initial]);

    // The owner leaves this open all day; it keeps itself current while looked at.
    useEffect(() => {
        let cancelled = false;

        const timer = window.setInterval(() => {
            if (document.hidden) {
                return;
            }

            fetchReportSummary()
                .then((fresh) => {
                    if (!cancelled) {
                        setReport(fresh);
                    }
                })
                .catch(() => undefined);
        }, REFRESH_MS);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, []);

    const { today, pace, days, hours, top_items: topItems } = report;
    const dishesSold = topItems.reduce(
        (total, item) => total + item.quantity,
        0,
    );

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                    tone="dahon"
                    label="Sales today"
                    value={formatPeso(today.sales)}
                    sub={`${today.paid_orders} paid ${today.paid_orders === 1 ? 'order' : 'orders'}`}
                />
                <StatTile
                    tone="kalamansi"
                    label="Orders today"
                    value={String(today.orders)}
                    sub={`${today.paid_orders} paid · ${today.cancelled_orders} cancelled`}
                />
                <StatTile
                    tone="ube"
                    label="Average per order"
                    value={formatPeso(today.average_order)}
                    sub="Paid orders only"
                />
                <StatTile
                    tone="achuete"
                    label="Dishes sold this week"
                    value={String(dishesSold)}
                    sub="Top five dishes"
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
                <div className="grid min-w-0 gap-4 2xl:grid-cols-[3fr_2fr]">
                    <SalesChart days={days} />

                    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                        <h2 className="font-semibold">Top dishes this week</h2>

                        {topItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No sales yet this week.
                            </p>
                        ) : (
                            <ol className="flex flex-col divide-y divide-border">
                                {topItems.map((item, index) => (
                                    <li
                                        key={item.name}
                                        className="flex items-center gap-3 py-2 first:pt-0"
                                    >
                                        <span className="w-4 text-sm text-muted-foreground">
                                            {index + 1}
                                        </span>

                                        {item.image === null ? (
                                            <span
                                                aria-hidden="true"
                                                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted font-display font-bold text-dahon/40"
                                            >
                                                {item.name.charAt(0)}
                                            </span>
                                        ) : (
                                            <img
                                                src={item.image.sm}
                                                alt=""
                                                width={36}
                                                height={36}
                                                loading="lazy"
                                                decoding="async"
                                                className="size-9 shrink-0 rounded-md object-cover"
                                            />
                                        )}

                                        <span className="min-w-0 flex-1 truncate font-medium">
                                            {item.name}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {item.quantity} sold
                                        </span>
                                        <span className="font-semibold">
                                            {formatPeso(item.sales)}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>

                <aside
                    aria-label="Today against yesterday, and the week's busy hours"
                    className="flex flex-col gap-4 xl:self-start"
                >
                    <PaceCard today={today.sales} pace={pace} />
                    <BusyHours hours={hours} />
                </aside>
            </div>
        </div>
    );
}
