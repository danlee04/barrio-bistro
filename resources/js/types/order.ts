export type OrderType = 'dine_in' | 'takeout';

export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'preparing'
    | 'ready'
    | 'completed'
    | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid';

export type PaymentMethod = 'counter' | 'online';

export type PaymentState = 'pending' | 'paid' | 'failed';

export type CheckoutOptions = {
    tables: number;
    methods: PaymentMethod[];
    online_minimum: number;
};

export type Payment = {
    checkout_url: string | null;
    amount: number;
    state: PaymentState;
    method: string | null;
    paid_at: string | null;
};

export type OrderLineInput = {
    menu_item_id: number;
    menu_item_size_id: number;
    quantity: number;
    note: string | null;
};

export type PlaceOrderInput = {
    type: OrderType;
    table_number: number | null;
    customer_name: string | null;
    payment_method: PaymentMethod;
    items: OrderLineInput[];
};

export type OrderItem = {
    id: number;
    item_name: string;
    size_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
    note: string | null;
};

export type OpsView = 'queue' | 'kitchen' | 'done';

export type Order = {
    token: string;
    order_number: string;
    daily_number: number;
    type: OrderType;
    type_label: string;
    table_number: number | null;
    customer_name: string | null;
    status: OrderStatus;
    status_label: string;
    payment_status: PaymentStatus;
    payment_method: PaymentMethod;
    payment_method_label: string;
    subtotal: number;
    total: number;
    placed_at: string | null;
    items: OrderItem[];
};

export type StaffOrder = Omit<Order, 'subtotal'> & {
    paid_at: string | null;
};
