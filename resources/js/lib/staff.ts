import type { LoaderFunctionArgs } from 'react-router';
import { http } from '@/lib/http';
import type { Paginated, Role, StaffUser } from '@/types';

export type NewStaff = {
    name: string;
    email: string;
    role: Role;
    password: string;
    password_confirmation: string;
};

export type StaffChanges = Partial<{
    name: string;
    email: string;
    role: Role;
    is_active: boolean;
}>;

export function listStaff(
    query: URLSearchParams,
): Promise<Paginated<StaffUser>> {
    return http.get<Paginated<StaffUser>>(
        `/api/v1/admin/staff?${query.toString()}`,
    );
}

export function createStaff(payload: NewStaff): Promise<{ data: StaffUser }> {
    return http.post<{ data: StaffUser }>('/api/v1/admin/staff', payload);
}

export function updateStaff(
    id: number,
    changes: StaffChanges,
): Promise<{ data: StaffUser }> {
    return http.patch<{ data: StaffUser }>(
        `/api/v1/admin/staff/${id}`,
        changes,
    );
}

export function resetStaffPassword(
    id: number,
    payload: { password: string; password_confirmation: string },
): Promise<void> {
    return http.put<void>(`/api/v1/admin/staff/${id}/password`, payload);
}

/** Loader: the staff list for the page and search in the URL. */
export function staffPageLoader({
    request,
}: LoaderFunctionArgs): Promise<Paginated<StaffUser>> {
    const { searchParams } = new URL(request.url);
    const query = new URLSearchParams();

    for (const key of ['page', 'search']) {
        const value = searchParams.get(key);

        if (value) {
            query.set(key, value);
        }
    }

    return listStaff(query);
}
