import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useCart } from '@/lib/cart-context';
import { IDLE_MS, isIdle, isKiosk } from '@/lib/kiosk';
import { forgetOrder } from '@/lib/orders';

/** How often the tablet checks whether it has been left alone. */
const CHECK_MS = 5000;

/**
 * An order nobody came back to belongs to nobody. On the counter tablet, a
 * quiet minute and a half clears the cart and hands the screen to the next
 * person in the queue. It renders nothing, and does nothing on a phone.
 */
export function IdleWatch() {
    const { clear } = useCart();
    const navigate = useNavigate();
    const lastTouch = useRef(Date.now());

    useEffect(() => {
        if (!isKiosk()) {
            return;
        }

        function touched() {
            lastTouch.current = Date.now();
        }

        window.addEventListener('pointerdown', touched);
        window.addEventListener('keydown', touched);

        const timer = window.setInterval(() => {
            if (!isIdle(lastTouch.current, Date.now())) {
                return;
            }

            clear();
            forgetOrder();
            void navigate('/kiosk');
        }, CHECK_MS);

        return () => {
            window.removeEventListener('pointerdown', touched);
            window.removeEventListener('keydown', touched);
            window.clearInterval(timer);
        };
    }, [clear, navigate]);

    return null;
}

export { IDLE_MS };
