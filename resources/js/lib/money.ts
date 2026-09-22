const pesoFormatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

/** Format integer centavos for display, e.g. 12550 → "₱125.50". */
export function formatPeso(centavos: number): string {
    return pesoFormatter.format(centavos / 100);
}

/**
 * Read what a person types ("125", "125.5", "1,250.50", "₱ 99") as integer
 * centavos using string arithmetic only, so floating point can never change a
 * price. Returns null for anything that is not a plain peso amount.
 */
export function parsePesoToCentavos(input: string): number | null {
    const cleaned = input.replace(/[₱,\s]/g, '');
    const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(cleaned);

    if (match === null) {
        return null;
    }

    const pesos = Number(match[1]);
    const centavos = Number((match[2] ?? '').padEnd(2, '0'));

    return pesos * 100 + centavos;
}

/** Show integer centavos in a price input, e.g. 12550 → "125.50". */
export function centavosToInput(centavos: number): string {
    const pesos = Math.floor(centavos / 100);
    const rest = String(centavos % 100).padStart(2, '0');

    return `${pesos}.${rest}`;
}
