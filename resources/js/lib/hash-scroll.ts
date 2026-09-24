import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * A link like `/offers#bulk` should land on the section, not the top of the
 * page: the target only exists once the page has rendered, so the jump waits
 * for that.
 */
export function useHashScroll(): void {
    const { hash } = useLocation();

    useEffect(() => {
        if (hash === '') {
            return;
        }

        document
            .getElementById(hash.slice(1))
            ?.scrollIntoView({ block: 'start' });
    }, [hash]);
}
