type StatTileProps = {
    label: string;
    value: string;
    sub?: string;
};

/** A headline number is not a chart: one figure, a quiet label, one line under. */
export function StatTile({ label, value, sub }: StatTileProps) {
    return (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl leading-none font-bold">{value}</p>
            {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
    );
}
