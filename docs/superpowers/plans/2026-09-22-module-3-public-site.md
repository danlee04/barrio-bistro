# Module 3 — Public Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Working agreement:** Claude writes the code and runs the verification commands. The user runs mutating commands and `git commit`. Commits are consolidated about every 5 steps.

**Goal:** The customer-facing site in the Bilao design: a home page whose hero is today's live menu ("On the stove this afternoon.") served as round plates with a woven bamboo rim, a full menu page, an "Our story" section and a "Visit" section with a live open/closed status. The admin code moves out of the public bundle.

**Architecture:** Two public routes (`/` and `/menu`) share a `PublicLayout` (header, skip link, footer with the staff login link). Both read the public `GET /api/v1/menu`. Restaurant facts (address, hours, phone, story) live in one typed content file with **sample** values marked for replacement. Time-dependent copy (morning/afternoon/tonight, open now) is computed in `Asia/Manila` whatever the visitor's device time zone, by pure functions covered by Vitest. Admin, login and account routes are code-split with React Router's `lazy`, so customers never download the admin UI.

**Tech Stack:** React 19 (native `<title>`/`<meta>` hoisting), React Router 8 (`lazy`, `ScrollRestoration`), Tailwind 4, Vitest via `vp test`.

**Spec:** `docs/superpowers/specs/2026-09-22-barrio-bistro-design.md` (Section 7)

## Global Constraints

- Language: **English**, with Filipino dish names as entered by the admin.
- Restaurant info is **hardcoded** in `resources/js/content/restaurant.ts`; every sample value says "(sample)".
- Location: an "Open in Google Maps" link (`target="_blank" rel="noopener noreferrer"`). **No embedded map** and no third-party scripts, so the CSP is unchanged.
- No gallery.
- Design tokens: the existing Bilao palette plus `--kawayan: #cda869` (bamboo rim). Display font Bricolage Grotesque, body Instrument Sans. Sentence case everywhere; no all-caps labels, no "→" in buttons, no middle-dot meta strings.
- Boldness goes in one place, the plate. Everything else is flat and quiet. The only shadow is under a plate.
- One motion moment: plates are "served" (drop in) when the home page loads, **only** under `prefers-reduced-motion: no-preference`.
- Mobile first: layouts work at 320px; `min-h-svh`, never `100vh`; fluid type uses `clamp()` with a `rem` term; touch targets are ≥ 44px; hover is never required.
- Images: `srcset` 400w/800w, explicit `width`/`height`, `loading="lazy"` except the first hero plates.
- A sold-out state is conveyed in text ("Sold out today"), not only by greying the plate.

## File Map

| File                                               | Responsibility                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `resources/js/content/restaurant.ts`               | Address, maps link, phone, hours, story (sample values)                             |
| `resources/js/lib/restaurant-time.ts` + `.test.ts` | `zonedParts`, `dayPart`, `openStatus`, `formatClock` (Manila time)                  |
| `resources/css/app.css`                            | `--kawayan`, `wrapper` utility, `.plate` rim, sold-out state, the "serve" animation |
| `resources/js/components/public/plate.tsx`         | Round photo in the woven rim                                                        |
| `resources/js/components/public/price-list.tsx`    | Single price or per-size prices                                                     |
| `resources/js/components/public/open-status.tsx`   | "Open now, closes at 9:00 PM"                                                       |
| `resources/js/layouts/public-layout.tsx`           | Header, skip link, footer, scroll restoration                                       |
| `resources/js/pages/home.tsx`                      | Hero, story, visit                                                                  |
| `resources/js/pages/menu.tsx`                      | Sticky category links + full menu                                                   |
| `resources/js/lib/public-menu.ts`                  | `publicMenuLoader`, `featuredItems()` (+ tests)                                     |
| `resources/js/router.tsx`                          | Public routes eager, admin/login/account `lazy`                                     |
| `resources/views/app.blade.php`                    | Meta description, theme colour, Open Graph                                          |

---

### Task 1: Restaurant content + Manila-time helpers (TDD)

- [ ] **Step 1: Failing test** — `resources/js/lib/restaurant-time.test.ts`

```ts
import { describe, expect, it } from 'vite-plus/test';
import type { OpeningHours } from '@/content/restaurant';
import {
    dayPart,
    formatClock,
    openStatus,
    zonedParts,
} from '@/lib/restaurant-time';

const MANILA = 'Asia/Manila';

// 2026-09-22 is a Tuesday; Manila is UTC+8.
const at = (utc: string) => new Date(`2026-09-22T${utc}Z`);

const hours: OpeningHours[] = [
    { day: 0, opens: '08:00', closes: '21:00' },
    { day: 1, opens: '10:00', closes: '21:00' },
    { day: 2, opens: '10:00', closes: '21:00' },
    { day: 3, opens: '10:00', closes: '21:00' },
    { day: 4, opens: '10:00', closes: '21:00' },
    { day: 5, opens: '10:00', closes: '22:00' },
    { day: 6, opens: '10:00', closes: '22:00' },
];

describe('zonedParts', () => {
    it('reads the wall clock in Manila, not the device time zone', () => {
        expect(zonedParts(at('04:00:00'), MANILA)).toEqual({
            day: 2,
            minutes: 12 * 60,
        });
        expect(zonedParts(at('17:30:00'), MANILA)).toEqual({
            day: 3,
            minutes: 90,
        });
    });
});

describe('dayPart', () => {
    it.each([
        ['01:30:00', 'morning'],
        ['03:59:00', 'morning'],
        ['04:00:00', 'afternoon'],
        ['08:59:00', 'afternoon'],
        ['09:00:00', 'tonight'],
        ['20:00:00', 'tonight'],
    ])('at %s UTC it is %s in Manila', (utc, expected) => {
        expect(dayPart(at(utc), MANILA)).toBe(expected);
    });
});

describe('openStatus', () => {
    it('is open during the day and says when it closes', () => {
        expect(openStatus(at('04:00:00'), hours, MANILA)).toEqual({
            isOpen: true,
            closesAt: '21:00',
        });
    });

    it('is closed before opening and says it opens later today', () => {
        expect(openStatus(at('01:30:00'), hours, MANILA)).toEqual({
            isOpen: false,
            opensAt: '10:00',
            opensDay: 2,
            opensToday: true,
        });
    });

    it('is closed after closing and points to the next day', () => {
        expect(openStatus(at('14:00:00'), hours, MANILA)).toEqual({
            isOpen: false,
            opensAt: '10:00',
            opensDay: 3,
            opensToday: false,
        });
    });

    it('skips days the restaurant is closed', () => {
        const weekdaysOnly = hours.filter(
            (entry) => entry.day >= 1 && entry.day <= 5,
        );

        // Friday 23:00 Manila → next opening is Monday.
        expect(
            openStatus(new Date('2026-09-25T15:00:00Z'), weekdaysOnly, MANILA),
        ).toEqual({
            isOpen: false,
            opensAt: '10:00',
            opensDay: 1,
            opensToday: false,
        });
    });

    it('knows when there are no hours at all', () => {
        expect(openStatus(at('04:00:00'), [], MANILA)).toEqual({
            isOpen: false,
            opensAt: null,
            opensDay: null,
            opensToday: false,
        });
    });
});

describe('formatClock', () => {
    it.each([
        ['21:00', '9:00 PM'],
        ['10:30', '10:30 AM'],
        ['12:00', '12:00 PM'],
        ['00:15', '12:15 AM'],
    ])('shows %s as %s', (time, expected) => {
        expect(formatClock(time)).toBe(expected);
    });
});
```

- [ ] **Step 2: Run (FAIL)** — `npm run test`.

- [ ] **Step 3: `resources/js/content/restaurant.ts`**

```ts
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
```

- [ ] **Step 4: `resources/js/lib/restaurant-time.ts`**

```ts
import type { OpeningHours } from '@/content/restaurant';

export type DayPart = 'morning' | 'afternoon' | 'tonight';

export type OpenStatus =
    | { isOpen: true; closesAt: string }
    | {
          isOpen: false;
          opensAt: string | null;
          opensDay: number | null;
          opensToday: boolean;
      };

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Day of week (0 = Sunday) and minutes after midnight on the wall clock of a time zone. */
export function zonedParts(
    date: Date,
    timeZone: string,
): { day: number; minutes: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);

    const part = (type: string) =>
        parts.find((entry) => entry.type === type)?.value ?? '';

    return {
        day: weekdays.indexOf(part('weekday')),
        minutes: Number(part('hour')) * 60 + Number(part('minute')),
    };
}

/** Morning 05:00–11:59, afternoon 12:00–16:59, tonight otherwise. */
export function dayPart(date: Date, timeZone: string): DayPart {
    const { minutes } = zonedParts(date, timeZone);

    if (minutes >= 5 * 60 && minutes < 12 * 60) {
        return 'morning';
    }

    if (minutes >= 12 * 60 && minutes < 17 * 60) {
        return 'afternoon';
    }

    return 'tonight';
}

function toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);

    return hours * 60 + minutes;
}

/** Whether the restaurant is open now, and when it closes or next opens. */
export function openStatus(
    date: Date,
    hours: OpeningHours[],
    timeZone: string,
): OpenStatus {
    const now = zonedParts(date, timeZone);
    const today = hours.find((entry) => entry.day === now.day);

    if (
        today &&
        now.minutes >= toMinutes(today.opens) &&
        now.minutes < toMinutes(today.closes)
    ) {
        return { isOpen: true, closesAt: today.closes };
    }

    if (today && now.minutes < toMinutes(today.opens)) {
        return {
            isOpen: false,
            opensAt: today.opens,
            opensDay: now.day,
            opensToday: true,
        };
    }

    for (let offset = 1; offset <= 7; offset += 1) {
        const day = (now.day + offset) % 7;
        const next = hours.find((entry) => entry.day === day);

        if (next) {
            return {
                isOpen: false,
                opensAt: next.opens,
                opensDay: day,
                opensToday: false,
            };
        }
    }

    return { isOpen: false, opensAt: null, opensDay: null, opensToday: false };
}

/** "21:00" → "9:00 PM". */
export function formatClock(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;

    return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
```

- [ ] **Step 5: Run (PASS)** — `npm run test`.

---

### Task 2: Featured items helper (TDD)

- [ ] **Step 1: Failing test** — `resources/js/lib/public-menu.test.ts`

```ts
import { describe, expect, it } from 'vite-plus/test';
import { featuredItems } from '@/lib/public-menu';
import type { MenuCategory, MenuItem } from '@/types';

const item = (id: number, overrides: Partial<MenuItem> = {}): MenuItem => ({
    id,
    category_id: 1,
    name: `Dish ${id}`,
    description: null,
    image: null,
    is_available: true,
    is_featured: false,
    sort_order: id,
    archived_at: null,
    sizes: [{ id, name: 'Regular', price: 10000 }],
    ...overrides,
});

const menu = (items: MenuItem[]): MenuCategory[] => [
    {
        id: 1,
        name: 'Meals',
        slug: 'meals',
        description: null,
        sort_order: 0,
        archived_at: null,
        items,
    },
];

describe('featuredItems', () => {
    it('prefers featured items that are available', () => {
        const result = featuredItems(
            menu([
                item(1),
                item(2, { is_featured: true }),
                item(3, { is_featured: true, is_available: false }),
            ]),
        );

        expect(result.map((entry) => entry.id)).toEqual([2]);
    });

    it('falls back to the first available items when nothing is featured', () => {
        const result = featuredItems(
            menu([item(1, { is_available: false }), item(2), item(3)]),
        );

        expect(result.map((entry) => entry.id)).toEqual([2, 3]);
    });

    it('shows at most five plates', () => {
        const result = featuredItems(
            menu(
                [1, 2, 3, 4, 5, 6, 7].map((id) =>
                    item(id, { is_featured: true }),
                ),
            ),
        );

        expect(result).toHaveLength(5);
    });
});
```

- [ ] **Step 2: Run (FAIL)**, then **Step 3:** `resources/js/lib/public-menu.ts`:

```ts
import { fetchMenu } from '@/lib/menu';
import type { MenuCategory, MenuItem } from '@/types';

const HERO_LIMIT = 5;

/** The plates for the hero: available featured items, else the first available ones. */
export function featuredItems(categories: MenuCategory[]): MenuItem[] {
    const available = categories
        .flatMap((category) => category.items)
        .filter((entry) => entry.is_available);
    const featured = available.filter((entry) => entry.is_featured);

    return (featured.length > 0 ? featured : available).slice(0, HERO_LIMIT);
}

/** Loader: the public menu for the home and menu pages. */
export function publicMenuLoader(): Promise<MenuCategory[]> {
    return fetchMenu();
}
```

- [ ] **Step 4: Run (PASS)**.

---

### Task 3: Styles — kawayan rim, wrapper, serve animation

In `resources/css/app.css`: add `--kawayan: #cda869;` to `:root`, and `--color-kawayan: var(--kawayan);` to `@theme inline`. Then append:

```css
@utility wrapper {
    inline-size: min(100% - 2rem, 72rem);
    margin-inline: auto;
}

@layer components {
    /* A plate on a bilao: the photo sits inside a woven bamboo rim. */
    .plate {
        position: relative;
        flex-shrink: 0;
        border-radius: 9999px;
        padding: 0.4rem;
        background: repeating-conic-gradient(
            var(--kawayan) 0deg 5deg,
            color-mix(in oklab, var(--kawayan) 70%, var(--uling)) 5deg 10deg
        );
        box-shadow: 0 0.9rem 1.4rem -0.8rem
            color-mix(in oklab, var(--uling) 60%, transparent);
    }

    .plate-sold-out {
        filter: grayscale(1);
        opacity: 0.55;
    }

    @media (prefers-reduced-motion: no-preference) {
        .serve {
            animation: serve 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
            animation-delay: calc(var(--serve-order, 0) * 90ms);
        }
    }
}

@keyframes serve {
    from {
        opacity: 0;
        transform: translateY(-1.25rem) rotate(-10deg) scale(0.96);
    }

    to {
        opacity: 1;
        transform: none;
    }
}
```

Verify: `npm run build` (Tailwind compiles the new utility and classes).

---

### Task 4: Public components + layout

- `resources/js/components/public/plate.tsx` — the round photo in the rim (initial letter when there is no photo); `size: 'hero' | 'menu'`; `priority` makes the image eager with `fetchPriority="high"`.
- `resources/js/components/public/price-list.tsx` — one size: a single large price; several sizes: a two-column `dl` of size name and price.
- `resources/js/components/public/open-status.tsx` — `openStatus(new Date(), restaurant.hours, restaurant.timeZone)` rendered as "Open now, closes at 9:00 PM" (kalamansi dot) or "Closed now, opens at 10:00 AM" / "opens Wednesday at 10:00 AM".
- `resources/js/layouts/public-layout.tsx` — skip link, header (wordmark → `/`, links Menu / Story / Visit), `<main id="content">`, footer (name, year, a small "Staff login" link), `<ScrollRestoration />`. The header links stay visible at 320px (three short links, no hamburger).

---

### Task 5: Home page

`resources/js/pages/home.tsx` (loader `publicMenuLoader`):

1. **Hero** (`bg-dahon text-pandan`): `<h1>` "On the stove {this morning | this afternoon | tonight}." in Bricolage at `clamp(2.75rem, 1.75rem + 5vw, 6.5rem)`; a list of up to five featured plates with name and price. Each `<li>` gets `className="serve"` and `style={{ '--serve-order': index }}`, and odd plates sit lower on `md+` so they read as plates on a table. Then the "See the full menu" button. An empty menu shows "Today's menu is being prepared. Check back soon."
2. **Our story** (`id="story"`): the paragraphs from the content file, `max-w-[65ch]`.
3. **Visit** (`id="visit"`): `OpenStatus`, the address lines, the hours as a `dl` (Monday first, closed days shown as "Closed"), a phone `tel:` link, and "Open in Google Maps" (external, `noopener noreferrer`).
4. Hash scrolling: when `location.hash` is `#story` or `#visit`, scroll that section into view.
5. `<title>Barrio Bistro</title>` and a `<meta name="description">`.

---

### Task 6: Menu page

`resources/js/pages/menu.tsx` (loader `publicMenuLoader`):

- `<h1>Menu</h1>` and a sticky, horizontally scrollable category nav (`aria-label="Categories"`) of anchor links to `#{slug}`; sections get `scroll-mt-20`.
- Each category is an `<h2>` plus a `ul` (1 column, 2 from `md`) of rows: `Plate size="menu"`, name, description (`line-clamp-3`), `PriceList`, and "Sold out today" for unavailable items.
- An empty menu shows "Today's menu is being prepared. Check back soon."
- `<title>Menu | Barrio Bistro</title>`.

---

### Task 7: Router with code-splitting + meta

- `resources/js/router.tsx`: a pathless `PublicLayout` route wrapping `/` (Home) and `/menu` (Menu), both with `publicMenuLoader` and `errorElement: <RouteError />`. `/login`, `/account/password`, `/admin` and every admin child use `lazy: async () => ({ Component: (await import('…')).default })`; loaders stay static.
- `resources/views/app.blade.php`: `<meta name="description">`, `<meta name="theme-color" content="#1f3d2b">`, and `og:title`, `og:description`, `og:type`.
- Verify: `npm run build` lists separate chunks for the admin pages, and the entry chunk is well under the previous 477 kB.

---

### Task 8: Module 3 gate

- [ ] `npm run test`, `npm run types:check`, `npm run check`, `npm run build`; `composer run test`.
- [ ] Responsive (user, DevTools): 320, 375, 768, 1280 and 1920 px on `/` and `/menu`, with no horizontal scroll (the console overflow snippet prints nothing), plates are round, and the category nav scrolls sideways on phones.
- [ ] Reduced motion: with DevTools "Emulate CSS prefers-reduced-motion: reduce", plates appear without animation.
- [ ] Production CSP check for Modules 2 and 3: stop dev, remove `public/hot`, `npm run build`, `php artisan serve`, then check `/`, `/menu`, and `/admin/menu` (photos, dialogs, selects). No CSP errors in the console.
- [ ] Commit: `git commit -m "feat: public site with bilao plates, menu and visit info"`.
