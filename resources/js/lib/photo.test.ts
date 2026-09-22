import { describe, expect, it } from 'vite-plus/test';
import { squareCrop } from '@/lib/photo';

describe('squareCrop', () => {
    it.each([
        ['landscape', 1200, 900, { x: 150, y: 0, size: 900 }],
        ['portrait', 900, 1600, { x: 0, y: 350, size: 900 }],
        ['square', 800, 800, { x: 0, y: 0, size: 800 }],
        ['odd widths round down', 1001, 1000, { x: 0, y: 0, size: 1000 }],
        ['small photos', 300, 200, { x: 50, y: 0, size: 200 }],
        ['huge phone photos', 8000, 6000, { x: 1000, y: 0, size: 6000 }],
    ])(
        'keeps the centred square of a %s image',
        (_label, width, height, expected) => {
            expect(squareCrop(width, height)).toEqual(expected);
        },
    );
});
