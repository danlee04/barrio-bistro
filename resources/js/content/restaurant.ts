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
    tagline: string;
    timeZone: string;
    addressLines: string[];
    mapsUrl: string;
    phone: { display: string; tel: string };
    facebookUrl: string | null;
    story: string[];
    /**
     * Real words from real customers, with their permission. Replace every
     * "(sample)" line before this site goes live: invented praise misleads the
     * people it is written for.
     */
    testimonials: {
        quote: string;
        name: string;
        note: string;
        /**
         * Optional file under `public/images/avatars`, with the customer's
         * permission. Without one the card shows their initial.
         */
        avatar?: string;
    }[];
    hours: OpeningHours[];
    /** Files under `public/images`. See that folder's README. */
    photos: {
        hero: string;
        story: string;
        kitchen: string;
        counter: string;
        interior: string;
        street: string;
        table: string;
    };
};

/**
 * Everything the public site says about the restaurant.
 *
 * SAMPLE CONTENT — replace each value marked "(sample)" with Barrio Bistro's
 * real details. Days missing from `hours` are shown as closed.
 */
export const restaurant: Restaurant = {
    name: 'Barrio Bistro',
    tagline: 'Filipino neighbourhood kitchen',
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
        'There is a kind of Filipino cooking that never made it onto a menu: the pot left on a low flame all afternoon, the plate that arrives while the rice is still steaming, the second helping nobody asked for. That is what comes out of this kitchen.',
        'Adobo left to darken until the sauce clings to the pork. Sisig that still crackles on its way to the table. Kare-kare thick with peanut, and a sinigang sour enough to make you sit up. Everything is cooked to order — nothing waits under a lamp for somebody to want it.',
        'Order at the counter or from your own phone, and we will call your number when the plate is up. Feeding a party or an office? Tell us the day and the headcount, and we will cook for as many as you bring.',
    ],
    testimonials: [
        {
            quote: 'The adobo tastes like my lola made it, and it arrived while the rice was still steaming. (sample)',
            name: 'Maria S. (sample)',
            note: 'Dine in, Saturday lunch',
        },
        {
            quote: 'We ordered two bilao of pancit for the office and they were ready exactly when they said. (sample)',
            name: 'Jun P. (sample)',
            note: 'Bulk order',
        },
        {
            quote: 'Ordered from the tablet, paid with GCash, and my number was called in ten minutes. (sample)',
            name: 'Grace T. (sample)',
            note: 'Take out',
        },
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
    photos: {
        hero: '/images/hero.jpg',
        story: '/images/story.jpg',
        kitchen: '/images/kitchen.jpg',
        counter: '/images/counter.jpg',
        interior: '/images/interior.jpg',
        street: '/images/street.jpg',
        table: '/images/table.jpg',
    },
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
