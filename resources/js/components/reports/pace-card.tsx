import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { formatPeso } from '@/lib/money';
import type { ReportSummary } from '@/types';

type PaceCardProps = {
    today: number;
    pace: ReportSummary['pace'];
};

/**
 * Today measured against yesterday to the same minute. The tile above already
 * says what today has taken, so this card only carries what that number cannot
 * say on its own: ₱4,000 is a good morning or a bad day depending entirely on
 * what yesterday had done by now.
 */
export function PaceCard({ today, pace }: PaceCardProps) {
    const difference = today - pace.yesterday;
    const percent =
        pace.yesterday === 0
            ? null
            : Math.round((difference / pace.yesterday) * 100);

    const Icon =
        difference === 0 ? Minus : difference > 0 ? ArrowUp : ArrowDown;

    return (
        <div className="flex flex-col gap-1 rounded-xl bg-dahon p-4 text-pandan">
            <p className="text-sm text-pandan/75">Against yesterday</p>

            {percent === null ? (
                <p className="font-display text-xl leading-tight font-bold">
                    Nothing sold by this time yesterday
                </p>
            ) : (
                <>
                    <p className="flex items-center gap-2 font-display text-3xl leading-none font-bold tabular-nums">
                        <Icon aria-hidden="true" className="size-6 shrink-0" />
                        {Math.abs(percent)}%
                    </p>
                    <p className="text-sm">
                        {difference === 0
                            ? 'level with yesterday by now'
                            : `${difference > 0 ? 'ahead' : 'behind'} by ${formatPeso(Math.abs(difference))} at this hour`}
                    </p>
                </>
            )}

            <p className="text-sm text-pandan/75">
                {pace.yesterday_full === 0
                    ? 'Yesterday sold nothing at all'
                    : `Yesterday finished at ${formatPeso(pace.yesterday_full)}`}
            </p>
        </div>
    );
}
