# Module 9a — Site Split & Marketing Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the one public site into two: a website a visitor reads, and a till a customer orders from.

**Architecture:** Two layouts under two route branches. The marketing branch keeps the menu loader and gains `/about` and `/contact`; the ordering branch holds the POS menu, checkout and the order's status, and is the only place the cart exists. No server change and no migration — every route here is client-side, and the SPA catch-all already serves them.

**Tech Stack:** React 19, React Router 8, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-public-website-and-kiosk-design.md`

## Global Constraints

- `/order/{token}` **keeps its path**: PayMongo's `success_url` and `cancel_url` are built server-side from it, and guests hold links to it. (spec §2)
- The cart lives **only** in the ordering layout. A visitor reading the website never sees a cart.
- `/menu` becomes reading matter: prices and sold-out, no Add, no size picking.
- Copy stays English; the palette, Google Sans and the existing components carry over.
- Mobile-first: everything works at 320px with no horizontal scroll, and tap targets stay at least 44px.
- This module is layout and copy only, so it adds no tests; the existing 206 PHP and 67 Vitest tests must stay green. (CLAUDE.md → test enforcement)
- Commands the **user** runs: `git commit`.

## File Structure

| File                                              | Responsibility                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `resources/js/layouts/marketing-layout.tsx`       | _Rename of_ `public-layout.tsx`: full nav, Order now, rich footer   |
| `resources/js/layouts/order-layout.tsx`           | The till: name, cart, nothing else                                  |
| `resources/js/pages/menu.tsx`                     | _Rewrite:_ the menu to read                                         |
| `resources/js/pages/order/menu.tsx`               | _Moved from_ the old `menu.tsx`: the POS menu with cards and filter |
| `resources/js/pages/about.tsx`                    | The story                                                           |
| `resources/js/pages/contact.tsx`                  | Phone, Facebook, map, hours                                         |
| `resources/js/pages/cart.tsx`                     | _Moved to_ `resources/js/pages/order/checkout.tsx`                  |
| `resources/js/components/public/menu-listing.tsx` | The read-only dish row used by `/menu`                              |
| `resources/js/router.tsx`                         | _Modify:_ the two branches                                          |
| `resources/js/components/cart/cart-dock.tsx`      | _Modify:_ links to `/order/checkout`                                |

---

### Task 1: Two branches, two layouts

**Files:**

- Create: `resources/js/layouts/order-layout.tsx`
- Rename: `resources/js/layouts/public-layout.tsx` → `marketing-layout.tsx`
- Modify: `resources/js/router.tsx`, `resources/js/components/cart/cart-dock.tsx`

**Interfaces:**

- Produces: route branch `public` (marketing: `/`, `/menu`, `/about`, `/contact`, `*`) and route branch `order` (`/order`, `/order/checkout`, `/order/:token`), each with its own layout. `CartDock` lives in the order layout and points at `/order/checkout`.

- [ ] **Step 1: Write `resources/js/layouts/order-layout.tsx`**

The till: the shop's name (linking back to the website), the hanging cart, and a quiet footer line. No navigation that invites leaving mid-order.

- [ ] **Step 2: Rename the public layout and widen its navigation**

`marketing-layout.tsx` keeps the three-zone header (name · links · Your order) and gains an **Order now** button on the right; the footer grows to carry hours, address and the staff login.

- [ ] **Step 3: Rewire `resources/js/router.tsx`**

```tsx
    {
        id: 'public',
        element: <MarketingLayout />,
        errorElement: <RouteError />,
        loader: publicMenuLoader,
        children: [
            { path: '/', element: <Home /> },
            { path: '/menu', element: <Menu /> },
            { path: '/about', element: <About /> },
            { path: '/contact', element: <Contact /> },
            { path: '*', element: <NotFound /> },
        ],
    },
    {
        id: 'order',
        path: '/order',
        element: <OrderLayout />,
        errorElement: <RouteError />,
        loader: publicMenuLoader,
        children: [
            { index: true, element: <OrderMenu /> },
            { path: 'checkout', element: <Checkout />, loader: checkoutOptionsLoader },
            { path: ':token', element: <OrderStatus />, loader: orderLoader, errorElement: <RouteError /> },
        ],
    },
```

Static `checkout` outranks the `:token` parameter in React Router, and a ULID can never read "checkout", so the two cannot collide.

- [ ] **Step 4: Point the cart at the new checkout**

In `cart-dock.tsx`, the Checkout button navigates to `/order/checkout`, and the dock hides itself on `/order/checkout` rather than `/cart`.

- [ ] **Step 5: Verify**

Run: `npm run check:fix`, `npm run types:check`, `npm test`, `npm run build`

---

### Task 2: A menu to read, and a menu to order from

**Files:**

- Create: `resources/js/components/public/menu-listing.tsx`
- Rewrite: `resources/js/pages/menu.tsx`
- Move: the old `menu.tsx` body → `resources/js/pages/order/menu.tsx`
- Move: `resources/js/pages/cart.tsx` → `resources/js/pages/order/checkout.tsx`

**Interfaces:**

- Produces: `<MenuListing item={item} />` — photo, name, description, every size with its price, and "Sold out today" where it applies; `/menu` renders it grouped by category with the same category filter; `/order` keeps the POS cards.

- [ ] **Step 1: Write the read-only row**

A square photo, the dish name, its description, and each size with its price as a small list. Nothing to press.

- [ ] **Step 2: Rewrite `/menu` around it**

Keep the category filter chips and the `?c=` parameter, drop the cart, and end the page with an **Order now** call to action into `/order`.

- [ ] **Step 3: Move the POS menu and the checkout**

`resources/js/pages/order/menu.tsx` is today's `/menu` — cards, sizes, Add, the filter — and `resources/js/pages/order/checkout.tsx` is today's cart page, with its heading changed from "Your order" to "Checkout".

- [ ] **Step 4: Verify**

Run: `npm run check:fix`, `npm run types:check`, `npm test`, `npm run build`

---

### Task 3: About and Contact

**Files:**

- Create: `resources/js/pages/about.tsx`, `resources/js/pages/contact.tsx`

**Interfaces:**

- Consumes: `restaurant` from `@/content/restaurant`, `OpenStatus`.

- [ ] **Step 1: `/about`**

The story in full, the shop's name as a heading, and a line back to the menu. Reads on one screen, line length under 70 characters.

- [ ] **Step 2: `/contact`**

Open-or-closed now, the week's hours, the address, a phone link, the Facebook link when there is one, and the **Open in Google Maps** button. The same details stay on the home page in short form.

- [ ] **Step 3: Verify**

Run: `npm run check:fix`, `npm run types:check`, `npm test`, `npm run build`

---

### Task 4: Module gate

- [ ] **Step 1: Every check**

Run: `php artisan test --compact`, `composer types:check`, `composer lint:check`, `npm test`, `npm run types:check`, `npm run check`, `npm run build`

- [ ] **Step 2: The walkthrough**

With `composer run dev`: read `/menu` and confirm there is no cart anywhere; press **Order now**; add two dishes at `/order`; open the cart and press Checkout, landing on `/order/checkout`; place the order and land on `/order/{token}`; walk `/about` and `/contact`; check 320px and 1280px for both branches.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: split the website from the till, with about and contact pages"
```
