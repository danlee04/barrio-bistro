import { redirect } from 'react-router';
import { HttpError, http } from '@/lib/http';
import type { Abilities, CurrentUser, StaffUser } from '@/types';

type CurrentUserResponse = {
    data: StaffUser;
    abilities: Abilities;
};

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
    try {
        const response = await http.get<CurrentUserResponse>('/api/v1/me');

        return { user: response.data, abilities: response.abilities };
    } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
            return null;
        }

        throw error;
    }
}

export function login(email: string, password: string): Promise<void> {
    return http.post<void>('/login', { email, password });
}

export function logout(): Promise<void> {
    return http.post<void>('/logout');
}

export function changePassword(payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
}): Promise<void> {
    return http.put<void>('/api/v1/me/password', payload);
}

/** Loader: the login page is only for guests. */
export async function guestLoader(): Promise<null> {
    const current = await fetchCurrentUser();

    if (current !== null) {
        throw redirect(
            current.user.must_change_password ? '/account/password' : '/admin',
        );
    }

    return null;
}

/** Loader: any signed-in staff member. */
export async function authLoader(): Promise<CurrentUser> {
    const current = await fetchCurrentUser();

    if (current === null) {
        throw redirect('/login');
    }

    return current;
}

/** Loader: signed-in staff who have replaced their temporary password. */
export async function staffLoader(): Promise<CurrentUser> {
    const current = await authLoader();

    if (current.user.must_change_password) {
        throw redirect('/account/password');
    }

    return current;
}
