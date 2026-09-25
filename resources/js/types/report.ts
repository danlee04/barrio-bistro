export type DaySales = {
    date: string;
    label: string;
    sales: number;
    orders: number;
};

export type TopItem = {
    name: string;
    quantity: number;
    sales: number;
    /** Missing when the dish never had a photo, or the line lost its item. */
    image: { sm: string; md: string } | null;
};

export type HourSlot = {
    hour: number;
    label: string;
    orders: number;
};

export type ReportSummary = {
    today: {
        date: string;
        sales: number;
        orders: number;
        paid_orders: number;
        cancelled_orders: number;
        average_order: number;
    };
    pace: {
        /** Paid takings up to this same time of day yesterday. */
        yesterday: number;
        /** What yesterday finished at. */
        yesterday_full: number;
    };
    days: DaySales[];
    hours: HourSlot[];
    top_items: TopItem[];
};
