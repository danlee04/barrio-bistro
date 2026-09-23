const MUTE_KEY = 'bb.kitchen-muted';

/** A short two-note beep, made in the browser: no file, no network, no CSP. */
export function playChime(): void {
    if (chimeMuted()) {
        return;
    }

    try {
        const context = new AudioContext();
        const gain = context.createGain();

        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            context.currentTime + 0.45,
        );
        gain.connect(context.destination);

        [880, 1320].forEach((frequency, index) => {
            const tone = context.createOscillator();

            tone.type = 'sine';
            tone.frequency.value = frequency;
            tone.connect(gain);
            tone.start(context.currentTime + index * 0.18);
            tone.stop(context.currentTime + index * 0.18 + 0.16);
        });

        window.setTimeout(() => void context.close(), 900);
    } catch {
        // A kitchen without sound still has its eyes.
    }
}

export function chimeMuted(): boolean {
    try {
        return globalThis.localStorage?.getItem(MUTE_KEY) === '1';
    } catch {
        return false;
    }
}

export function setChimeMuted(muted: boolean): void {
    try {
        globalThis.localStorage?.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
        // The switch simply will not be remembered.
    }
}
