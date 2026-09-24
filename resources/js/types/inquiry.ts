export type InquiryType = 'bulk' | 'contact';

export type InquiryStatus = 'new' | 'read' | 'closed';

export type Inquiry = {
    id: number;
    type: InquiryType;
    type_label: string;
    name: string;
    contact: string;
    event_date: string | null;
    guests: number | null;
    message: string;
    status: InquiryStatus;
    status_label: string;
    created_at: string | null;
};
