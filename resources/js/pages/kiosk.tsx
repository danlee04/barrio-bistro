import { useEffect, useRef, useState } from 'react';
import { useNavigate, useRouteLoaderData, useSearchParams } from 'react-router';
import { Plate } from '@/components/public/plate';
import { Button } from '@/components/ui/button';
import { restaurant } from '@/content/restaurant';
import { clearCart } from '@/lib/cart';
import { isKiosk, setKiosk } from '@/lib/kiosk';
import { forgetOrder } from '@/lib/orders';
import { featuredItems, type publicMenuLoader } from '@/lib/public-menu';
import { cn } from '@/lib/utils';

/** How long each dish holds the screen before the next one comes up. */
const TURN_MS = 4000;

/** How long the shop's name must be held to leave kiosk mode. */
const EXIT_MS = 3000;

/**
 * The idle screen on the counter tablet. It starts every customer from nothing:
 * the cart is emptied and the last order forgotten before anyone touches it.
 */
export default function Kiosk() {
    const categories =
        useRouteLoaderData<typeof publicMenuLoader>('kiosk') ?? [];
    const plates = featuredItems(categories);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [shown, setShown] = useState(0);
    const [kiosk, setKioskState] = useState(() => isKiosk());
    const holding = useRef<number | null>(null);

    const featured = plates.length === 0 ? null : plates[shown % plates.length];

    // Nothing of the last customer survives onto this screen.
    useEffect(() => {
        clearCart();
        forgetOrder();
    }, []);

    // `/kiosk?setup=1` turns this tablet into the kiosk; `?setup=0` hands it
    // back, so a device is never stuck in kiosk mode with no way out.
    useEffect(() => {
        const setup = searchParams.get('setup');

        if (setup !== '1' && setup !== '0') {
            return;
        }

        setKiosk(setup === '1');
        setKioskState(setup === '1');

        const next = new URLSearchParams(searchParams);
        next.delete('setup');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        if (
            plates.length < 2 ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            return;
        }

        const timer = window.setInterval(
            () => setShown((current) => current + 1),
            TURN_MS,
        );

        return () => window.clearInterval(timer);
    }, [plates.length]);

    function startHold() {
        holding.current = window.setTimeout(() => {
            setKiosk(false);
            void navigate('/');
        }, EXIT_MS);
    }

    function endHold() {
        if (holding.current !== null) {
            window.clearTimeout(holding.current);
            holding.current = null;
        }
    }

    return (
        <>
            <title>{`Order | ${restaurant.name}`}</title>

            <div className="kiosk-stage flex min-h-svh flex-col bg-dahon text-pandan">
                <p
                    onPointerDown={startHold}
                    onPointerUp={endHold}
                    onPointerLeave={endHold}
                    className="wrapper py-6 font-display text-2xl font-bold tracking-tight select-none"
                >
                    {restaurant.name}
                </p>

                <button
                    type="button"
                    onClick={() => void navigate('/order')}
                    className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16"
                >
                    {featured !== null && (
                        <span
                            key={featured.id}
                            className={cn(
                                'serve flex flex-col items-center gap-4',
                            )}
                        >
                            <Plate item={featured} size="feature" priority />
                            <span className="text-xl font-medium">
                                {featured.name}
                            </span>
                        </span>
                    )}

                    <span className="flex flex-col items-center gap-3">
                        <span className="font-display text-[clamp(2.5rem,1.5rem+6vw,5rem)] leading-none font-bold tracking-tight">
                            Touch to order
                        </span>
                        <span className="text-lg text-pandan/70">
                            Pay at the counter, or with GCash or a card
                        </span>
                    </span>
                </button>

                {/* This screen looks the same either way, so without saying so
                    the shop cannot tell that the tablet is still behaving like
                    an ordinary phone: no clearing between customers, and no
                    coming back here after an order. */}
                {!kiosk && (
                    <div className="wrapper flex flex-wrap items-center justify-between gap-3 border-t border-pandan/15 py-4 text-sm">
                        <p className="text-pandan/70">
                            This device is not the counter tablet yet. Orders
                            here behave like any other phone.
                        </p>
                        <Button
                            type="button"
                            variant="secondary"
                            className="min-h-11 rounded-full px-5"
                            onClick={() => {
                                setKiosk(true);
                                setKioskState(true);
                            }}
                        >
                            Use this device as the counter tablet
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
