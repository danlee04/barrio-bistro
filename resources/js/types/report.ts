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
    days: DaySales[];
    top_items: TopItem[];
};
