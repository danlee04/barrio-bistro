# Barrio Bistro — Public Website & Counter Kiosk

**Date:** 2026-09-24
**Status:** Approved
**Builds on:** `2026-09-22-barrio-bistro-design.md` (Modules 0–8). This spec splits what that one called "the public site" into two faces and adds what a visitor who is not in the shop needs.

## 1. Why this exists

Until now one set of screens served two different people at once: a visitor reading about the shop, and a customer standing in it with money in hand. The menu page tried to be a brochure and a till at the same time.

They are separated here:

| Audience             | Where they are                           | What they need                                                                                         |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Visitor**          | At home, on a phone or laptop            | What the shop is, what it sells, what it looks like, how to reach it, and whether it can cater a party |
| **Walk-in customer** | At the counter, on the shop's own tablet | To order, fast, without reading anything else                                                          |
| **Staff**            | Behind the counter                       | Unchanged: queue, kitchen, menu, reports (Modules 5–7)                                                 |

## 2. Site map

**Marketing — the website a visitor reads**

| Route      | Holds                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `/`        | Hero, what the shop offers, today's dishes, a look at the gallery, hours and address, "Order now" |
| `/menu`    | The full menu to **read**: prices, sizes, what is sold out today. No cart.                        |
| `/about`   | The shop's story                                                                                  |
| `/gallery` | Photos of the food and the room                                                                   |
| `/offers`  | Dine in · Take out · **Bulk orders and catering**, with an enquiry form                           |
| `/contact` | Phone, Facebook, map, and an enquiry form                                                         |

**Ordering — the till**

| Route             | Holds                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/order`          | The POS menu: cards, sizes, Add, the cart in the corner                                                                    |
| `/order/checkout` | Dine in or take out, who it is for, how to pay, Place order                                                                |
| `/order/{token}`  | The order's number and status. **Unchanged path** — PayMongo's return URLs and every link already handed out keep working. |
| `/kiosk`          | The idle screen on the shop's tablet: "Touch to order"                                                                     |

A visitor may also order: the marketing pages carry an **Order now** button into `/order`. Because they may not be seated, the checkout asks who the order is for rather than assuming a table.

## 3. Two layouts

**Marketing layout** — full navigation (Menu · About · Gallery · Offers · Contact), an **Order now** button, and a footer carrying hours, address, socials and the staff login.

**Ordering layout** — deliberately bare: the shop's name, the cart, and nothing that invites leaving the flow mid-order.

## 4. The counter kiosk

The shop has **one tablet, at the counter**. Customers queue at it and order there.

- **Idle screen** (`/kiosk`): today's dishes rotating large, the shop's name, and **"Touch to order"**. Touching it opens `/order`.
- **Kiosk mode** is a flag stored on that device alone. Only a device in kiosk mode returns to the idle screen; a customer's own phone never sees it.
- **After an order**: the number is shown large with "Pay at the counter", then the screen returns to idle — on a tap of _Done_, or by itself after about twenty seconds.
- **When abandoned**: about ninety seconds without a touch clears the cart and returns to idle, so nobody inherits the last customer's order.
- **No table number at the kiosk.** The customer is standing at the counter, not sitting. A **name** is taken instead, and the order number is what gets called. The server rule becomes: a dine-in order needs **a table number or a name**, not both. The table-from-QR flow (Module 4) still works untouched if it is ever used.

Because there is one device, the printable table QR codes planned for Module 8 are dropped.

## 5. What is added behind the screens

| Table            | Purpose                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gallery_photos` | `path`, `caption`, `sort_order`. Uploaded by an admin through the same pipeline as menu photos: re-encoded to WebP at 400/800, renamed, stored on a disk that cannot execute. |
| `inquiries`      | `type` (bulk / contact), `name`, `contact`, `event_date`, `guests`, `message`, `status` (new / read / closed). Written by the public form, read only by staff.                |

**Public endpoints:** `GET /gallery`, `POST /inquiries`.
**Admin endpoints:** gallery CRUD, inquiry list and status.

## 6. Security

The rules in `CLAUDE.md` → _Security Guidelines_ and §6 of the original spec continue to apply. What this spec adds:

- **The enquiry form is a public write**, so it carries: a per-IP throttle, a honeypot field that must stay empty, hard length limits on every field, and validation of the contact as an email or a phone. It sends no mail in this module — staff read it in the admin.
- **Enquiries are PII.** Only staff may list them; they are never exposed publicly, never logged in full, and the audit trail records who read or closed one.
- **Gallery uploads** reuse the Module 2 pipeline: mime sniffing, re-encode, generated filename, public disk without execution.
- **The kiosk is a shared device.** It clears the cart and forgets the last order when it returns to idle, so one customer's order never shows to the next.

## 7. Build order

| #      | Module                       | Scope                                                                                                                   |
| ------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **9a** | Site split & marketing pages | Two layouts, the new routes, `/about`, `/contact` (details only), `/menu` as reading matter, ordering moved to `/order` |
| **9b** | Counter kiosk                | Idle screen, kiosk mode, the reset rules, name-instead-of-table                                                         |
| **9c** | Gallery                      | Admin upload and ordering, the public page                                                                              |
| **9d** | Enquiries                    | The bulk-order and contact forms, the admin list                                                                        |
| **8**  | Hardening & deploy           | Last, and without the table QR codes                                                                                    |

## 8. Decisions taken on 2026-09-24

1. Visitors **may order** from the website, not only from inside the shop.
2. The gallery is **admin-managed**, not written into the code.
3. Enquiries are **stored and read in the admin**, not just an email address on a page.
4. The website is built **before** deployment.
5. The kiosk is **one tablet at the counter**, with an idle screen, and takes a **name** rather than a table number.
