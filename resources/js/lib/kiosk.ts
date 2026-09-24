const KIOSK_KEY = 'bb.kiosk';

/** How long an untouched order waits before the screen clears itself. */
export const IDLE_MS = 90_000;

/** How long the order number stays up before the kiosk greets the next guest. */
export const DONE_MS = 20_000;

/** Whether this device is the shop's counter tablet. */
export function isKiosk(): boolean {
    try {
        return globalThis.localStorage?.getItem(KIOSK_KEY) === '1';
    } catch {
        return false;
    }
}

export function setKiosk(on: boolean): void {
    try {
        if (on) {
            globalThis.localStorage?.setItem(KIOSK_KEY, '1');
        } else {
            globalThis.localStorage?.removeItem(KIOSK_KEY);
        }
    } catch {
        // A tablet that cannot remember simply behaves like a phone.
    }
}

export function isIdle(lastTouch: number, now: number): boolean {
    return now - lastTouch >= IDLE_MS;
}
