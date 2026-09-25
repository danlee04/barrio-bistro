import { redirect, type LoaderFunctionArgs } from 'react-router';
import { HttpError, http } from '@/lib/http';
import type { Abilities, CurrentUser, Role, StaffUser } from '@/types';

/**
 * Where each role starts. The dashboard is a reports screen, and reports are
 * admin-only — sending a cashier there lands them on a page whose loader is
 * refused before it can draw anything.
 */
const home: Record<Role, string> = {
    admin: '/admin',
    cashier: '/admin/orders',
    kitchen: '/admin/kitchen',
};

export type TwoFactorState = {
    /** A second factor is on and confirmed for this account. */
    enabled: boolean;
    /** This account may not open the admin without one. */
    required: boolean;
};

type CurrentUserResponse = {
    data: StaffUser;
    abilities: Abilities;
    two_factor: TwoFactorState;
};

export type TwoFactorSetup = {
    secret: string;
    uri: string;
    /** The same address as a QR code, ready for an <img src>. */
    qr: string;
};

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
    try {
        const response = await http.get<CurrentUserResponse>('/api/v1/me');

        return {
            user: response.data,
            abilities: response.abilities,
            twoFactor: response.two_factor,
        };
    } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
            return null;
        }

        throw error;
    }
}

/**
 * The password step. A `two_factor` answer means nobody is signed in yet: the
 * six digits have to follow before the session counts for anything.
 */
export async function login(
    email: string,
    password: string,
): Promise<{ twoFactorNeeded: boolean }> {
    const response = await http.post<{ two_factor?: boolean } | undefined>(
        '/login',
        { email, password },
    );

    return { twoFactorNeeded: response?.two_factor === true };
}

/** The second step: six digits from the app, or one recovery code. */
export function answerTwoFactorChallenge(payload: {
    code?: string;
    recovery_code?: string;
}): Promise<void> {
    return http.post<void>('/two-factor-challenge', payload);
}

export async function twoFactorStatus(): Promise<{
    enabled: boolean;
    pending: boolean;
    required: boolean;
    recovery_codes_left: number;
}> {
    const response = await http.get<{
        data: {
            enabled: boolean;
            pending: boolean;
            required: boolean;
            recovery_codes_left: number;
        };
    }>('/api/v1/me/two-factor');

    return response.data;
}

export async function startTwoFactorSetup(): Promise<TwoFactorSetup> {
    const response = await http.post<{ data: TwoFactorSetup }>(
        '/api/v1/me/two-factor',
    );

    return response.data;
}

export async function confirmTwoFactor(code: string): Promise<string[]> {
    const response = await http.post<{ data: { recovery_codes: string[] } }>(
        '/api/v1/me/two-factor/confirm',
        { code },
    );

    return response.data.recovery_codes;
}

export async function replaceRecoveryCodes(
    password: string,
): Promise<string[]> {
    const response = await http.post<{ data: { recovery_codes: string[] } }>(
        '/api/v1/me/two-factor/recovery-codes',
        { password },
    );

    return response.data.recovery_codes;
}

/** The password travels with it: the server asks for it again on purpose. */
export function disableTwoFactor(password: string): Promise<void> {
    return http.delete<void>('/api/v1/me/two-factor', { password });
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

/** Loader: where this account stands on the second factor. */
export async function twoFactorLoader(): Promise<{
    enabled: boolean;
    pending: boolean;
    required: boolean;
    recovery_codes_left: number;
}> {
    await authLoader();

    return twoFactorStatus();
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
export async function staffLoader({
    request,
}: LoaderFunctionArgs): Promise<CurrentUser> {
    const current = await authLoader();

    if (current.user.must_change_password) {
        throw redirect('/account/password');
    }

    // An admin without a second factor is refused by every admin endpoint, so
    // send them to turn it on rather than to a screen that cannot load.
    if (current.twoFactor.required && !current.twoFactor.enabled) {
        throw redirect('/account/two-factor');
    }

    // Only the bare /admin is redirected: everywhere else the staff member
    // asked for that page, and this is about where they land, not where they
    // may go.
    const landing = home[current.user.role];

    if (new URL(request.url).pathname === '/admin' && landing !== '/admin') {
        throw redirect(landing);
    }

    return current;
}
