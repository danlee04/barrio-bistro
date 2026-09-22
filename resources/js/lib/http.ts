export type ValidationErrors = Record<string, string[]>;

export type ApiErrorBody = {
    message?: string;
    code?: string;
    errors?: ValidationErrors;
};

export class HttpError extends Error {
    readonly status: number;

    readonly body: ApiErrorBody;

    constructor(status: number, body: ApiErrorBody) {
        super(body.message ?? `Request failed with status ${status}`);
        this.name = 'HttpError';
        this.status = status;
        this.body = body;
    }

    get errors(): ValidationErrors {
        return this.body.errors ?? {};
    }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function readCookie(name: string): string | null {
    const prefix = `${name}=`;
    const cookie = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(prefix));

    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

let csrfCookieRequest: Promise<void> | null = null;

function ensureCsrfCookie(forceRefresh = false): Promise<void> {
    if (
        forceRefresh ||
        csrfCookieRequest === null ||
        readCookie('XSRF-TOKEN') === null
    ) {
        csrfCookieRequest = fetch('/sanctum/csrf-cookie', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        }).then(() => undefined);
    }

    return csrfCookieRequest;
}

async function send<T>(
    method: Method,
    url: string,
    body?: unknown,
    isRetry = false,
): Promise<T> {
    const isMutation = method !== 'GET';

    if (isMutation) {
        await ensureCsrfCookie();
    }

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    const isFormData = body instanceof FormData;

    if (body !== undefined && !isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    const xsrfToken = readCookie('XSRF-TOKEN');

    if (isMutation && xsrfToken !== null) {
        headers['X-XSRF-TOKEN'] = xsrfToken;
    }

    const response = await fetch(url, {
        method,
        headers,
        credentials: 'same-origin',
        body:
            body === undefined
                ? undefined
                : isFormData
                  ? body
                  : JSON.stringify(body),
    });

    if (response.status === 419 && !isRetry) {
        await ensureCsrfCookie(true);

        return send<T>(method, url, body, true);
    }

    if (!response.ok) {
        const errorBody = (await response
            .json()
            .catch(() => ({}))) as ApiErrorBody;

        throw new HttpError(response.status, errorBody);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
}

export const http = {
    get: <T>(url: string) => send<T>('GET', url),
    post: <T>(url: string, body?: unknown) => send<T>('POST', url, body),
    put: <T>(url: string, body?: unknown) => send<T>('PUT', url, body),
    patch: <T>(url: string, body?: unknown) => send<T>('PATCH', url, body),
    delete: <T>(url: string) => send<T>('DELETE', url),
};
