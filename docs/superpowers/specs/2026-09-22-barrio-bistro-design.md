# Barrio Bistro — Design Spec

**Date:** 2026-09-22
**Status:** Approved (Sections 1–4)

## 1. Overview

Barrio Bistro is an **in-store self-ordering system** (QR menu ordering) with three parts:

| Part            | Audience          | Contents                                                                     |
| --------------- | ----------------- | ---------------------------------------------------------------------------- |
| Public site     | Guests / visitors | Landing, story (Kwento), location & hours, gallery                           |
| Menu + cart     | Walk-in customers | Categories (Meals, Snacks, Drinks, …), add to cart, checkout, order tracking |
| Admin dashboard | Staff (RBAC)      | Menu CRUD, orders queue, kitchen display, users, reports                     |

**Decisions**

- Customers use **guest checkout** only — no customer accounts.
- Staff roles: **Admin, Cashier, Kitchen**.
- Payment: customer chooses **Pay at counter** or **online via PayMongo** (GCash / card).

## 2. Architecture — Approach A

A single Laravel app that serves a **REST API** plus a **React SPA** built by Vite.

| Layer    | Choice                                                                                        |
| -------- | --------------------------------------------------------------------------------------------- |
| Backend  | Laravel 13, PHP 8.4                                                                           |
| API      | `routes/api.php`, Form Requests, API Resources, versioned under `/api/v1`                     |
| Auth     | Breeze `api` stack + **Sanctum SPA cookie auth** (httpOnly session cookie, `XSRF-TOKEN` CSRF) |
| Frontend | React 19 + TypeScript, **React Router**, Tailwind CSS 4, **shadcn/ui**                        |
| Database | MySQL (Laragon locally, same in production)                                                   |
| Tests    | Pest                                                                                          |
| Deploy   | Single deploy (VPS / Hostinger-style)                                                         |

**Rejected:** separate repositories (double deploys, CORS, bearer tokens) and Inertia (no real REST API; a mobile app would need a new backend).

**Current repo state:** the repo was scaffolded with the Laravel React starter kit, which uses Inertia and Wayfinder. Module 0 removes Inertia and Wayfinder and replaces them with Breeze API, Sanctum and React Router. React 19, TypeScript, Tailwind 4, Vite, Pest, Boost, `clsx` and `tailwind-merge` are kept. The DB connection moves from SQLite to MySQL.

## 3. Modules (build order, one at a time)

| #   | Module              | Scope                                                                             |
| --- | ------------------- | --------------------------------------------------------------------------------- |
| 0   | Foundation          | Remove Inertia/Wayfinder, Breeze API + Sanctum, React SPA + Router, shadcn, MySQL |
| 1   | Auth & RBAC         | Roles, `is_active`, Gates, Policies, role middleware, staff login                 |
| 2   | Catalog             | Categories + menu items CRUD, image upload, availability toggle                   |
| 3   | Public site         | Landing, Kwento, menu browse — the UI/UX showcase                                 |
| 4   | Cart & Checkout     | Guest cart, table number, order placement                                         |
| 5   | Payments            | Pay-at-counter + PayMongo (GCash/card), webhooks                                  |
| 6   | Orders Ops          | Cashier queue, kitchen display, status state machine                              |
| 7   | Dashboard & Reports | Sales charts, top items, stat cards                                               |
| 8   | Hardening & Deploy  | Rate limits, headers, CSP, audit log review, CI, production                       |

## 4. Data Model

| Table         | Purpose                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`       | Staff accounts only (`role`, `is_active`). No customers.                                                                                               |
| `categories`  | Meals, Snacks, Drinks, … with `sort_order` for menu ordering.                                                                                          |
| `menu_items`  | Belongs to a category. `price` in centavos, `is_available` toggle for instant "Ubos na" (sold out).                                                    |
| `orders`      | Human-readable `order_number` (`BB-20260922-0031`), opaque `order_token` (ULID), `table_number`, `status`, `payment_status`, `payment_method`, totals. |
| `order_items` | **Snapshots** item name and unit price at order time, so old receipts never change.                                                                    |
| `payments`    | One row per attempt (history for retries). `provider_reference` is unique.                                                                             |
| `audit_logs`  | Who changed what and when (prices, roles, refunds).                                                                                                    |

**Engineering decisions**

1. **Money as integer centavos** (`12500` = ₱125.00). No floats or decimals in arithmetic.
2. **Native RBAC:** a `role` enum column plus Policies and Gates. No Spatie package, because there are only three roles.

## 5. Order State Machine

Order status and payment status are two independent tracks:

```
status:          pending → confirmed → preparing → ready → completed
                    ↓
                 cancelled

payment_status:  unpaid → paid
                    ↓  ↘
                 failed  refunded
```

They are kept separate because food can be ready but unpaid (pay at counter), or paid but not yet cooked (online payment).

|                      | Pay at counter                | Online (PayMongo)                           |
| -------------------- | ----------------------------- | ------------------------------------------- |
| Cart submitted       | `pending` / `unpaid`          | `pending` / `unpaid` + redirect to PayMongo |
| Moves to `confirmed` | Cashier clicks "Mark as Paid" | Signed PayMongo **webhook**                 |
| Kitchen sees it      | Once `confirmed`              | Once `confirmed`                            |

`paid` is set **only by the webhook**, never by the success redirect, because a customer can fake the redirect.

## 6. Security Layers

The project-wide rules in `CLAUDE.md` → _Security Guidelines_ apply. The design-specific layers are below.

**Authentication (staff only)**

- Breeze `api` + Sanctum cookie auth: the httpOnly session can't be read by JS.
- CSRF via `XSRF-TOKEN`.
- Login throttle: 5 attempts per minute.
- `is_active` flag: disable a staff account without deleting its order history.

**Authorization — three layers**

| Layer      | Use                   | Example                                                         |
| ---------- | --------------------- | --------------------------------------------------------------- |
| Middleware | Route groups          | `role:admin` on `/api/v1/admin/users`                           |
| Policy     | Per model, per action | `OrderPolicy@markPaid`: cashier only, not on `completed` orders |
| Gate       | Cross-cutting ability | `Gate::define('view-reports')`                                  |

`Gate::before()` grants Admin all abilities.

**Input & data**

- A Form Request on every write endpoint. Pass only `$request->validated()` to models.
- Explicit `$fillable` on every model.
- API Resources on every response, so no column leaks.
- **Server-side price recompute at checkout.** Client prices are ignored and totals come from the DB.
- Image uploads: validate the mime type and size, re-encode, rename, and store on a non-executable disk.

**Orders & money**

- Guests track orders by opaque `order_token` (ULID), never by numeric ID, to prevent IDOR.
- PayMongo webhook signature verification.
- Webhook idempotency via the unique `provider_reference`.
- Order placement runs inside a DB transaction.
- `audit_logs` entries for price, role and refund changes.

**Transport & headers:** HTTPS only, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, CSP, `config:cache` in production, and secrets only in `.env`.

## 7. UI/UX Direction — "Bilao"

A bilao is the round woven bamboo tray used for pancit and kakanin at handaan. **Menu cards are round plates, not rectangles.** All the boldness goes into the plates, and everything around them stays quiet.

```
┌─────────────────────────────────────────────┐
│  BARRIO BISTRO          Menu  Kwento  Punta │
├─────────────────────────────────────────────┤
│   Nasa kalan                                │  ← hero = today's live menu
│   ngayong hapon.                            │
│    ( ● )   ( ● )   ( ○ )   ( ● )            │  ← round plates; ○ = sold out
│    Adobo   Sisig   Kare    Lumpia           │
│    ₱180    ₱220    ₱260    ₱120             │
├─────────────────────────────────────────────┤
│  MEALS ─────────────────────────────────    │
│    ( ● )   ( ● )   ( ● )                    │
└─────────────────────────────────────────────┘
```

The hero shows the real menu of the day, and `is_available` is visible: sold-out plates are dimmed and labelled "Ubos na".

**Color tokens**

| Token         | Hex       | Source                                 |
| ------------- | --------- | -------------------------------------- |
| `--dahon`     | `#1F3D2B` | Banana leaf — deep green hero ground   |
| `--pandan`    | `#EDF0E6` | Pale green-white surface (not cream)   |
| `--achuete`   | `#E2571E` | Annatto oil — warm accent, CTA, "bago" |
| `--kalamansi` | `#9CB43C` | Green-yellow — available, success      |
| `--ube`       | `#5B3A8C` | Dessert, secondary accent              |
| `--uling`     | `#17110F` | Charcoal — text                        |

**Typefaces:** Bricolage Grotesque (display) and Instrument Sans (body).

**Principles**

1. The plate is the hero. Round food images; everything else is flat and quiet.
2. No decorative gradients. The only shadow is under a lifted plate.
3. Prices are large and direct. No "starting at", no strikethrough drama.
4. One motion moment: the plate lifting into the cart.

**Admin dashboard:** deliberately plain. `--pandan` ground, dense tables, and achuete only for new incoming orders. It is optimized for glance-reading during a rush. It uses shadcn defaults, reskinned through CSS variables.

## 8. Working Agreement

- The user types every command. Claude guides one step per message and gives a one-sentence explanation per step.
- Each module is finished (code + tests passing) before the next one starts.
