# AMPREX demo

Operating core for battery sale + on-site installation in Tehran:
order → compatible battery → stock check → assignment → technician mission →
installation + core return (باتری داغی) → payment → completion → admin report.

## Layout

| Path              | What                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `apps/api`        | NestJS 12 (ESM), Prisma 7 + PostgreSQL, Swagger at `/api/docs`       |
| `apps/web`        | Next.js 16 App Router: `/` (site), `/admin`, `/tech`; proxies `/api` |
| `packages/shared` | Statuses, Persian labels, roles, allowed transitions, error codes    |

## Run locally

Requires Node 24 and pnpm 10.34.7 (`corepack enable` or `npx pnpm@10.34.7`).

```bash
cp .env.example .env
pnpm install
pnpm db:up          # Postgres 17 in Docker (or point DATABASE_URL at your own)
pnpm db:migrate
pnpm db:seed        # wipes and recreates demo data
pnpm dev            # api :4000, web :3000
```

Swagger: http://localhost:4000/api/docs (or via the web origin: http://localhost:3000/api/docs).

> Using your own Postgres instead of Docker? The database must be **UTF8**. Windows installs often
> default to WIN1252, which cannot store Persian text: `CREATE DATABASE amprex ENCODING 'UTF8' TEMPLATE template0;`

## Tests

```bash
pnpm --filter @amprex/api test                                   # unit tests
E2E_DATABASE_URL=postgresql://…/amprex_e2e pnpm --filter @amprex/api test:e2e
```

The e2e suite (`apps/api/test`) runs `prisma migrate deploy` and then the seed, which **replaces all data** in
`E2E_DATABASE_URL`. Use a disposable database only. It drives the whole acceptance path over HTTP and also covers:
- out of stock, incompatible battery, a full slot and invalid transitions;
- two orders racing for the last unit;
- duplicate Idempotency-Key requests;
- branch scope.

## Screens (apps/web)

Built from the Claude Design handoff (`design-handoff/AMPREX.html`) with shadcn (RTL) components; colours and
radii are CSS variables in `apps/web/app/globals.css`. Every list has loading, empty and error states.

| Route | Screen |
| --- | --- |
| `/` | Customer home (mobile + desktop) |
| `/order?step=1..5` | Order flow: vehicle → battery → contact & address → slot → review |
| `/order/success`, `/track` | Order placed, order tracking (code + phone) |
| `/tech/login`, `/tech` | Technician login, today's missions |
| `/tech/missions/:id`, `…/finish`, `…/done` | Mission detail (5 steps), finish & settle, confirmation |
| `/admin/login`, `/admin` | Admin login, dashboard |
| `/admin/orders`, `/admin/orders/:id` | Orders table, order detail with technician assignment sheet |

Not built in this pass (shown greyed out in the admin menu): inventory and reports screens — the API for both exists.

## API map

| Who | Endpoints |
| --- | --- |
| Public (site) | `GET catalog/brands`, `GET catalog/vehicles?type=&brand=&q=`, `GET catalog/vehicles/:id/batteries?district=&availableOnly=`, `GET lookups/availability?district=`, `GET lookups/settings`, `POST orders` (Idempotency-Key), `POST orders/track` |
| Office | `GET orders`, `GET orders/counts`, `GET orders/:id`, `GET orders/:id/technicians`, `POST orders/:id/assign|cancel`, `GET dashboard`, `GET users/technicians`, `GET inventory/stock`, `POST inventory/receipts` |
| Technician | `GET missions?view=`, `POST missions/:orderId/accept|depart|arrive|start`, `GET missions/:orderId/settlement`, `POST missions/:orderId/finish` |
| Manager/admin | `GET reports/summary?from=&to=&branchId=` |

Lifecycle: `CREATED → ASSIGNED → ACCEPTED → EN_ROUTE → ON_SITE → INSTALLING → COMPLETED`, `CANCELLED` from any
step before completion. Every status change goes through `OrderStateService.transition()`. It checks the role against the
table in `packages/shared`, updates the order with a guard on the current status, and writes an `OrderEvent`,
all in the caller's transaction. Order responses include `allowedTransitions`, so the UI only shows
actions the API will accept. «ثبت پایان و تسویه» (`finish`) issues the battery, records the old battery and the
payment, and completes the order in one transaction.

Demo users (password = `SEED_DEMO_PASSWORD` from `.env`):

| Phone       | Role           | Branch | App |
| ----------- | -------------- | ------ | --- |
| 09120000001 | SUPER_ADMIN    | —      | `/admin` |
| 09120000002 | BRANCH_MANAGER | WEST   | `/admin` |
| 09120000003 | OPERATOR       | WEST   | `/admin` |
| 09120000004 | TECHNICIAN     | WEST   | `/tech` |

## Assumptions (فرضیات)

Rules are in `apps/api/src/config/business-rules.ts`; demo data is in `apps/api/prisma/seed-data.ts`.

1. **Order routing:** the customer picks a Tehran municipal district (1–22) and the order goes to the branch whose `serviceDistricts` covers it. WEST: 2,5,6,9,10,11,17,18,21,22. EAST: the rest. Neighbourhood names in the picker are indicative.
2. **Stock is reserved when the order is created**, released on cancel, and issued (onHand −1, reserved −1) at «ثبت پایان و تسویه».
3. **Stock before an address is known:** the battery step shows a battery as available if any branch has a free unit; the address step re-checks at the branch serving the district.
4. **One battery per order**, one mission per order. Reassigning keeps the mission row and resets acceptance.
5. **Price** = battery price − old-battery credit. **Installation is free.** Prices include VAT.
6. **Old-battery credit (باتری داغی) = 15,000 Toman per Ah** of the returned battery. The order-time estimate assumes the old battery has the new battery's Ah; the technician records the real Ah (20–200) at finish and the API recomputes the payable.
7. **Settlement:** one payment at finish (cash, POS or card-to-card). The amount received may differ from the payable; the difference is stored and shown to managers as «مغایرت تسویه».
8. **Gross profit** = payable − battery cost (snapshot at order time) + scrap value of the old battery (7,500 Toman per Ah). Visible to managers and super admins only.
9. **Cancellation** is allowed until completion, by office roles only.
10. **Booking window:** today and the next 6 days; today's slots close 60 minutes before they start. 4 daily slots, capacity 6 jobs per branch per slot.
11. **Technicians** have service districts and a daily capacity (6). The assignment sheet suggests the in-zone technician with the most jobs in that district that day, then the least loaded; a technician at capacity cannot be assigned.
12. **Dashboard alerts:** unassigned orders whose slot starts within 3 hours, technicians not on site 30 minutes into the slot, branch stock with ≤ 5 free units, and settlement mismatches from the last 7 days.
13. **Order codes** are `AMX-<Jalali YYMMDD>-<4 chars>` (no 0/O/1/I). Rows migrated from v1 got `AMX-LEGACY-<number>`.
14. **Channels:** website, phone («تلفنی»), Instagram, WhatsApp, Divar, partner («همکار»).
15. **Catalogue:** brands, prices, costs and compatibility are illustrative. Batteries fit vehicles with the same case group; same Ah as the factory spec = «پیشنهادی», otherwise «جایگزین». Motorcycles are listed but no motorcycle batteries are stocked yet.
16. **Anonymous orders are website orders.** Office staff may set the channel (the «ثبت سفارش تلفنی» button opens the order flow as PHONE). Branch staff can only create orders for districts their branch serves.
17. **Order tracking** is public with tracking code + phone via `POST` (the phone never appears in URLs) and returns a reduced view.
18. **Reports** cover orders *created* in the date range (Tehran days). Revenue = PAID payments of those orders.
19. **Technician logins:** only one of the 4 seeded technicians has an account (the demo TECHNICIAN user).
20. Money is stored as BigInt Rial and sent in JSON as a decimal string. The UI shows Toman (÷10).
21. **Sessions** are a JWT in localStorage («مرا در این دستگاه به خاطر بسپار») or sessionStorage. Fine for a demo; production should use an httpOnly cookie.

## Design handoff: what differs

Design elements with no backend were left out rather than faked:
SMS (order confirmation, technician introduction, invoice), photo upload and barcode scan at finish, changing the battery on site,
«وقتی موجود شد خبرم کن», CSV export («خروجی») and row checkboxes, «گزارش مشکل یا عدم امکان نصب», «تحویل به انبار» tracking,
ETA («رسیدن تقریبی»), editing address/time from the order detail, «فراموشی رمز», the «سؤالات متداول» link, and the «بیشتر» menu.
Sentences that promise SMS were removed from the success, assignment and confirmation screens.

Wording added where the design had no text for a state the app needs: logout («خروج»), cancel dialog («دلیل لغو»),
empty states (no missions today, no technicians found, no free slot that day, nothing needs attention), date presets on the
orders table, «تحویل نشد» for a not-returned old battery, and select placeholders («انتخاب کنید»).
The admin login keeps the design label «نام کاربری یا شماره موبایل», but only mobile numbers are accepted.
