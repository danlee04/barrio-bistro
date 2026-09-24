import { cn } from '@/lib/utils';

/**
 * The tones a tile can be painted in. Each pairs a brand colour with the ink
 * that stays readable on it: uling on achuete and kalamansi, pandan on the two
 * dark ones. White on achuete looks brighter but falls below 4.5:1.
 */
const tones = {
    plain: {
        block: 'border border-border bg-card',
        label: 'text-muted-foreground',
        sub: 'text-muted-foreground',
    },
    dahon: {
        block: 'bg-dahon text-pandan',
        label: 'text-pandan/75',
        sub: 'text-pandan/75',
    },
    achuete: {
        block: 'bg-achuete text-uling',
        label: 'text-uling/80',
        sub: 'text-uling/80',
    },
    kalamansi: {
        block: 'bg-kalamansi text-uling',
        label: 'text-uling/75',
        sub: 'text-uling/75',
    },
    ube: {
        block: 'bg-ube text-pandan',
        label: 'text-pandan/75',
        sub: 'text-pandan/75',
    },
} as const;

export type StatTone = keyof typeof tones;

type StatTileProps = {
    label: string;
    value: string;
    sub?: string;
    tone?: StatTone;
};

/** A headline number is not a chart: one figure, a quiet label, one line under. */
export function StatTile({ label, value, sub, tone = 'plain' }: StatTileProps) {
    const paint = tones[tone];

    return (
        <div className={cn('flex flex-col gap-1 rounded-xl p-4', paint.block)}>
            <p className={cn('text-sm', paint.label)}>{label}</p>
            <p className="font-display text-3xl leading-none font-bold tabular-nums">
                {value}
            </p>
            {sub && <p className={cn('text-sm', paint.sub)}>{sub}</p>}
        </div>
    );
}
