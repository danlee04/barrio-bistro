import { useState } from 'react';
import { cn } from '@/lib/utils';

type PhotoProps = {
    src: string;
    alt: string;
    className?: string;
    priority?: boolean;
};

/**
 * A photo from `public/images`. Until the shop drops the file in, the page
 * shows a quiet woven panel in its place rather than a broken image.
 */
export function Photo({ src, alt, className, priority = false }: PhotoProps) {
    const [missing, setMissing] = useState(false);

    if (missing) {
        return (
            <div
                aria-hidden="true"
                className={cn(
                    'bg-dahon/10 bg-[repeating-linear-gradient(135deg,var(--color-kawayan)_0_6px,transparent_6px_12px)] opacity-40',
                    className,
                )}
            />
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            onError={() => setMissing(true)}
            className={cn('object-cover', className)}
        />
    );
}
