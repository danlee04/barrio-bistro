import { useLoaderData, useRevalidator, useSearchParams } from 'react-router';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HttpError } from '@/lib/http';
import {
    setInquiryStatus,
    type inquiriesLoader,
    type StatusFilter,
} from '@/lib/inquiries';
import { cn } from '@/lib/utils';
import type { Inquiry, InquiryStatus } from '@/types';

const tabs: { value: StatusFilter; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'read', label: 'Read' },
    { value: 'closed', label: 'Closed' },
    { value: 'all', label: 'Everything' },
];

const badgeVariant: Record<InquiryStatus, 'default' | 'secondary' | 'outline'> =
    {
        new: 'default',
        read: 'secondary',
        closed: 'outline',
    };

function formatDay(value: string | null): string {
    if (value === null) {
        return '';
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function formatSent(value: string | null): string {
    if (value === null) {
        return '';
    }

    return new Date(value).toLocaleString('en-PH', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export default function AdminInquiries() {
    const { page, status } = useLoaderData<typeof inquiriesLoader>();
    const revalidator = useRevalidator();
    const [, setSearchParams] = useSearchParams();
    const [actionError, setActionError] = useState<string | null>(null);

    async function move(inquiry: Inquiry, next: InquiryStatus) {
        setActionError(null);

        try {
            await setInquiryStatus(inquiry.id, next);
            void revalidator.revalidate();
        } catch (caught) {
            setActionError(
                caught instanceof HttpError
                    ? caught.message
                    : 'Could not reach the server. Try again.',
            );
        }
    }

    return (
        <div className="flex max-w-4xl flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold">Messages</h1>
                <p className="text-muted-foreground">
                    Bulk orders and questions left on the website. These are
                    people's own details, so keep them here.
                </p>
            </div>

            <div className="flex flex-wrap gap-1" aria-label="Filter messages">
                {tabs.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        aria-pressed={status === tab.value}
                        onClick={() =>
                            setSearchParams(
                                tab.value === 'new'
                                    ? {}
                                    : { status: tab.value },
                            )
                        }
                        className={cn(
                            'min-h-11 rounded-full px-4 text-sm font-medium hover:bg-muted',
                            status === tab.value && 'bg-muted text-dahon',
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {actionError && (
                <Alert variant="destructive">
                    <AlertDescription>{actionError}</AlertDescription>
                </Alert>
            )}

            {page.data.length === 0 ? (
                <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                    Nothing here.
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {page.data.map((inquiry) => (
                        <li
                            key={inquiry.id}
                            className="flex flex-col gap-3 rounded-lg border bg-card p-4"
                        >
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <Badge variant={badgeVariant[inquiry.status]}>
                                    {inquiry.status_label}
                                </Badge>
                                <span className="font-semibold">
                                    {inquiry.name}
                                </span>
                                <span className="text-muted-foreground">
                                    {inquiry.type_label}
                                </span>
                                <span className="ml-auto text-sm text-muted-foreground">
                                    {formatSent(inquiry.created_at)}
                                </span>
                            </div>

                            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                                <dt className="text-muted-foreground">
                                    Reply to
                                </dt>
                                <dd className="font-medium">
                                    {inquiry.contact}
                                </dd>

                                {inquiry.event_date !== null && (
                                    <>
                                        <dt className="text-muted-foreground">
                                            Which day
                                        </dt>
                                        <dd>{formatDay(inquiry.event_date)}</dd>
                                    </>
                                )}

                                {inquiry.guests !== null && (
                                    <>
                                        <dt className="text-muted-foreground">
                                            People
                                        </dt>
                                        <dd>{inquiry.guests}</dd>
                                    </>
                                )}
                            </dl>

                            <p className="text-pretty whitespace-pre-line">
                                {inquiry.message}
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {inquiry.status === 'new' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            void move(inquiry, 'read')
                                        }
                                    >
                                        Mark as read
                                    </Button>
                                )}
                                {inquiry.status !== 'closed' && (
                                    <Button
                                        size="sm"
                                        onClick={() =>
                                            void move(inquiry, 'closed')
                                        }
                                    >
                                        Close
                                    </Button>
                                )}
                                {inquiry.status === 'closed' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            void move(inquiry, 'read')
                                        }
                                    >
                                        Reopen
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {page.meta.total > page.data.length && (
                <p className="text-sm text-muted-foreground">
                    Showing the newest {page.data.length} of {page.meta.total}.
                </p>
            )}
        </div>
    );
}
