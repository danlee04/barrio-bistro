import { describe, expect, it } from 'vite-plus/test';
import { centavosToInput, formatPeso, parsePesoToCentavos } from '@/lib/money';

describe('parsePesoToCentavos', () => {
    it.each([
        ['125', 12500],
        ['125.5', 12550],
        ['125.50', 12550],
        ['0.05', 5],
        ['1,250.75', 125075],
        ['₱ 99', 9900],
        ['  42.10 ', 4210],
    ])('reads %s as %i centavos', (input, expected) => {
        expect(parsePesoToCentavos(input)).toBe(expected);
    });

    it.each(['', 'abc', '12.345', '-5', '1e3', '12.', '.5', '1234567'])(
        'rejects %s',
        (input) => {
            expect(parsePesoToCentavos(input)).toBeNull();
        },
    );

    it('never drifts on amounts that break floating point', () => {
        expect(parsePesoToCentavos('0.29')).toBe(29);
        expect(parsePesoToCentavos('1.15')).toBe(115);
        expect(parsePesoToCentavos('4.35')).toBe(435);
    });
});

describe('centavosToInput', () => {
    it.each([
        [12550, '125.50'],
        [5, '0.05'],
        [100, '1.00'],
    ])('shows %i centavos as %s', (centavos, expected) => {
        expect(centavosToInput(centavos)).toBe(expected);
    });
});

describe('formatPeso', () => {
    it('formats centavos as pesos', () => {
        expect(formatPeso(12550)).toBe('₱125.50');
        expect(formatPeso(1250075)).toBe('₱12,500.75');
    });
});
