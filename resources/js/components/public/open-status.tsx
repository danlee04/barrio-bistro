import { dayNames, restaurant } from '@/content/restaurant';
import { formatClock, openStatus } from '@/lib/restaurant-time';
import { cn } from '@/lib/utils';

/** "Open now, closes at 9:00 PM" or when it next opens, in Manila time. */
export function OpenStatus({ className }: { className?: string }) {
    const status = openStatus(
        new Date(),
        restaurant.hours,
        restaurant.timeZone,
    );

    let message: string;

    if (status.isOpen) {
        message = `Open now, closes at ${formatClock(status.closesAt)}`;
    } else if (status.opensAt === null || status.opensDay === null) {
        message = 'Closed for now';
    } else if (status.opensToday) {
        message = `Closed now, opens at ${formatClock(status.opensAt)}`;
    } else {
        message = `Closed now, opens ${dayNames[status.opensDay]} at ${formatClock(status.opensAt)}`;
    }

    return (
        <p className={cn('flex items-center gap-2 font-medium', className)}>
            <span
                aria-hidden="true"
                className={cn(
                    'size-2.5 rounded-full',
                    status.isOpen ? 'bg-kalamansi' : 'bg-muted-foreground',
                )}
            />
            {message}
        </p>
    );
}
