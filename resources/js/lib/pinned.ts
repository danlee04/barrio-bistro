/**
 * How far a pinned note leans. Set as a custom property rather than a rotate
 * utility so the swing on hover leans off whichever angle the paper already
 * has, instead of snapping it straight first.
 */
const tilts = [
    '[--tilt:-2deg]',
    '[--tilt:1deg]',
    '[--tilt:0deg]',
    '[--tilt:2deg]',
    '[--tilt:-1deg]',
];

/**
 * A lean picked from a number the caller already has — an order's number, a
 * card's place in a list — so a note never jumps to a new angle on re-render.
 */
export function tiltFor(seed: number): string {
    return tilts[Math.abs(Math.trunc(seed)) % tilts.length];
}
