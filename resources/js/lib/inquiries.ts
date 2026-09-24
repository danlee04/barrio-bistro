import type { LoaderFunctionArgs } from 'react-router';
import { http } from '@/lib/http';
import type { Inquiry, InquiryStatus, InquiryType, Paginated } from '@/types';

type Wrapped<T> = { data: T };

/** The tabs on the admin screen: one per status, plus everything. */
export type StatusFilter = InquiryStatus | 'all';

const filters: StatusFilter[] = ['new', 'read', 'closed', 'all'];

export type InquiryInput = {
    type: InquiryType;
    name: string;
    contact: string;
    event_date: string | null;
    guests: number | null;
    message: string;
    /** The honeypot. A real person never sees this field, so it stays empty. */
    website: string;
};

/** Send a message from the website. Nothing but a thank-you comes back. */
export function sendInquiry(input: InquiryInput) {
    return http.post<{ message: string }>('/api/v1/inquiries', input);
}

export function listInquiries(
    status: StatusFilter,
): Promise<Paginated<Inquiry>> {
    const query = new URLSearchParams({ per_page: '50' });

    if (status !== 'all') {
        query.set('status', status);
    }

    return http.get<Paginated<Inquiry>>(
        `/api/v1/admin/inquiries?${query.toString()}`,
    );
}

export function setInquiryStatus(id: number, status: InquiryStatus) {
    return http.patch<Wrapped<Inquiry>>(`/api/v1/admin/inquiries/${id}`, {
        status,
    });
}

/** An unknown ?status= in the URL falls back to the new messages. */
export function statusFilterFrom(value: string | null): StatusFilter {
    return filters.find((filter) => filter === value) ?? 'new';
}

/** Loader: the message book for the status in the URL. */
export async function inquiriesLoader({
    request,
}: LoaderFunctionArgs): Promise<{
    page: Paginated<Inquiry>;
    status: StatusFilter;
}> {
    const status = statusFilterFrom(
        new URL(request.url).searchParams.get('status'),
    );

    return { page: await listInquiries(status), status };
}
