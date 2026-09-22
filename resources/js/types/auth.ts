export type Role = 'admin' | 'cashier' | 'kitchen';

export type StaffUser = {
    id: number;
    name: string;
    email: string;
    role: Role;
    role_label: string;
    is_active: boolean;
    must_change_password: boolean;
    last_login_at: string | null;
    created_at: string;
};

export type Abilities = {
    manage_staff: boolean;
};

export type CurrentUser = {
    user: StaffUser;
    abilities: Abilities;
};

export type Paginated<T> = {
    data: T[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
};
