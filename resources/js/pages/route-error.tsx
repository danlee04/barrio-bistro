import { Link, Navigate, useRouteError } from 'react-router';
import { HttpError } from '@/lib/http';

export default function RouteError() {
    const error = useRouteError();

    if (error instanceof HttpError && error.status === 401) {
        return <Navigate to="/login" replace />;
    }

    if (
        error instanceof HttpError &&
        error.body.code === 'password_change_required'
    ) {
        return <Navigate to="/account/password" replace />;
    }

    const message =
        error instanceof HttpError && error.status === 403
            ? 'You do not have access to this page.'
            : 'Something went wrong. Please try again.';

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
            <h1 className="text-2xl font-semibold">{message}</h1>
            <Link to="/admin" className="underline">
                Back to the dashboard
            </Link>
        </main>
    );
}
