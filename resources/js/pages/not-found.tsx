import { Link } from 'react-router';

export default function NotFound() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
            <h1 className="text-2xl font-semibold">
                Wala rito ang hinahanap mo.
            </h1>
            <Link to="/" className="underline">
                Bumalik sa home
            </Link>
        </main>
    );
}
