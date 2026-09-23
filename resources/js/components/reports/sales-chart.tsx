import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatPeso } from '@/lib/money';
import type { DaySales } from '@/types';

/** ₱1,250 → "₱1.3k", so the axis stays narrow. */
function shortPeso(centavos: number): string {
    const pesos = centavos / 100;

    return pesos >= 1000
        ? `₱${(pesos / 1000).toFixed(1)}k`
        : `₱${Math.round(pesos)}`;
}

type TooltipProps = {
    active?: boolean;
    payload?: { payload: DaySales }[];
};

function DayTooltip({ active, payload }: TooltipProps) {
    const day = payload?.[0]?.payload;

    if (active !== true || day === undefined) {
        return null;
    }

    return (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
            <p className="font-semibold">{day.label}</p>
            <p>{formatPeso(day.sales)}</p>
            <p className="text-muted-foreground">
                {day.orders} {day.orders === 1 ? 'order' : 'orders'}
            </p>
        </div>
    );
}

/**
 * One series, so the heading names it and no legend is needed. The curve is
 * monotone rather than a loose spline: a smooth line that cannot dip below the
 * days it joins, so a quiet Tuesday never looks like a loss. The table under it
 * carries the same numbers for anyone who cannot read a line.
 */
export function SalesChart({ days }: { days: DaySales[] }) {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">Sales, last 7 days</h2>

            <div aria-hidden="true" className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={days}
                        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    >
                        <CartesianGrid
                            vertical={false}
                            stroke="var(--color-border)"
                        />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{
                                fill: 'var(--color-muted-foreground)',
                                fontSize: 12,
                            }}
                        />
                        <YAxis
                            width={56}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={shortPeso}
                            tick={{
                                fill: 'var(--color-muted-foreground)',
                                fontSize: 12,
                            }}
                        />
                        <Tooltip
                            cursor={{
                                stroke: 'var(--color-muted-foreground)',
                                strokeWidth: 1,
                            }}
                            content={<DayTooltip />}
                        />
                        <Area
                            type="monotone"
                            dataKey="sales"
                            stroke="var(--color-chart-sales)"
                            strokeWidth={2}
                            fill="var(--color-chart-sales)"
                            fillOpacity={0.12}
                            dot={{
                                r: 4,
                                strokeWidth: 0,
                                fill: 'var(--color-chart-sales)',
                            }}
                            activeDot={{
                                r: 6,
                                strokeWidth: 2,
                                stroke: 'var(--color-card)',
                            }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <details className="text-sm">
                <summary className="min-h-11 cursor-pointer py-2 font-medium">
                    Show as table
                </summary>

                <table className="w-full text-left">
                    <caption className="sr-only">
                        Sales for the last seven days
                    </caption>
                    <thead>
                        <tr className="text-muted-foreground">
                            <th scope="col" className="py-1 font-medium">
                                Day
                            </th>
                            <th scope="col" className="py-1 font-medium">
                                Orders
                            </th>
                            <th
                                scope="col"
                                className="py-1 text-right font-medium"
                            >
                                Sales
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {days.map((day) => (
                            <tr
                                key={day.date}
                                className="border-t border-border"
                            >
                                <th scope="row" className="py-1 font-normal">
                                    {day.label}
                                </th>
                                <td className="py-1">{day.orders}</td>
                                <td className="py-1 text-right">
                                    {formatPeso(day.sales)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}
