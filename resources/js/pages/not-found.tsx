import { Link } from 'react-router';
import { restaurant } from '@/content/restaurant';

export default function NotFound() {
    return (
        <>
            <title>{`Page not found | ${restaurant.name}`}</title>
            <div className="wrapper flex flex-col items-start gap-4 py-20">
                <h1 className="font-display text-4xl font-bold tracking-tight">
                    We couldn't find that page.
                </h1>
                <p className="text-lg">
                    It may have moved, or the link has a typo.
                </p>
                <Link to="/" className="text-lg underline underline-offset-4">
                    Go to the home page
                </Link>
            </div>
        </>
    );
}
