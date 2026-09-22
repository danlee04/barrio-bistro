export type OpeningHours = {
    /** 0 = Sunday … 6 = Saturday, like Date#getDay(). */
    day: number;
    /** 24-hour "HH:MM". */
    opens: string;
    /** 24-hour "HH:MM", later the same day. */
    closes: string;
};

export type Restaurant = {
    name: string;
    timeZone: string;
    addressLines: string[];
    mapsUrl: string;
    phone: { display: string; tel: string };
    facebookUrl: string | null;
    story: string[];
    hours: OpeningHours[];
};

/**
 * Everything the public site says about the restaurant.
 *
 * SAMPLE CONTENT — replace each value marked "(sample)" with Barrio Bistro's
 * real details. Days missing from `hours` are shown as closed.
 */
export const restaurant: Restaurant = {
    name: 'Barrio Bistro',
    timeZone: 'Asia/Manila',
    addressLines: [
        '123 Sample Street (sample)',
        'Barangay Poblacion',
        'Quezon City, Metro Manila',
    ],
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Barrio+Bistro',
    phone: { display: '0917 123 4567 (sample)', tel: '+639171234567' },
    facebookUrl: null,
    story: [
        'Barrio Bistro cooks the dishes of a Filipino neighbourhood kitchen: slow adobo, crackling sisig, kare-kare on a Sunday. (sample)',
        'Order from your table, pay at the counter or with GCash, and we bring it to you while it is still steaming. (sample)',
    ],
    hours: [
        { day: 0, opens: '08:00', closes: '21:00' },
        { day: 1, opens: '10:00', closes: '21:00' },
        { day: 2, opens: '10:00', closes: '21:00' },
        { day: 3, opens: '10:00', closes: '21:00' },
        { day: 4, opens: '10:00', closes: '21:00' },
        { day: 5, opens: '10:00', closes: '22:00' },
        { day: 6, opens: '10:00', closes: '22:00' },
    ],
};

export const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];
