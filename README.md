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

## API map

| Who            | Endpoints                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Public (site)  | `GET catalog/vehicles`, `GET catalog/vehicles/:id/batteries?district=`, `GET lookups/availability?district=`, `POST orders` (Idempotency-Key), `GET orders/track?number=&phone=` |
| Office         | `GET orders`, `GET orders/:id`, `POST orders/:id/assign\|cancel\|complete`, `GET users/technicians`, `GET inventory/stock`, `POST inventory/receipts` |
| Technician     | `GET missions?view=`, `POST missions/:orderId/depart\|arrive\|install`, `POST orders/:orderId/payments` |
| Manager/admin  | `GET reports/summary?from=&to=&branchId=`                                                       |

Every status change goes through `OrderStateService.transition()`. It checks the role against the
table in `packages/shared`, updates the order with a guard on the current status, and writes an `OrderEvent`,
all in the caller's transaction. Order responses include `allowedTransitions`, so the UI only shows
actions the API will accept.

Demo users (password = `SEED_DEMO_PASSWORD` from `.env`):

| Phone       | Role           | Branch |
| ----------- | -------------- | ------ |
| 09120000001 | SUPER_ADMIN    | —      |
| 09120000002 | BRANCH_MANAGER | WEST   |
| 09120000003 | OPERATOR       | WEST   |
| 09120000004 | TECHNICIAN     | WEST   |

## Assumptions (فرضیات)

Rules are in `apps/api/src/config/business-rules.ts`; demo data is in `apps/api/prisma/seed-data.ts`.

1. **Order routing:** the customer gives a Tehran municipal district (1–22) and the order goes to the branch whose `serviceDistricts` covers it. WEST: 2,5,6,9,10,11,17,18,21,22. EAST: the rest.
2. **Stock is reserved when the order is created** (status `CREATED`), released on cancel, and issued (onHand −1, reserved −1) at `INSTALLED`.
3. **One battery per order**, one mission per order. Reassigning a technician keeps the order in `ASSIGNED` and logs an event.
4. **Price** = battery price + flat install fee (350,000 Toman) − core credit. Prices include VAT.
5. **Core credit (باتری داغی):** if the customer says they will return the old battery, the full credit is estimated up front. At installation the technician records the outcome: intact = 100%, damaged = 50%, not returned = 0%. The total is corrected then.
6. **Payment is taken after installation**, by technician or operator, in a single payment equal to the total.
7. **Completion** (`PAID → COMPLETED`) is an office action (operator / manager / admin).
8. **Cancellation** is allowed until installation, by office roles only.
9. **Booking window:** from tomorrow up to 7 days ahead, 4 daily slots, capacity 2 jobs per branch per slot.
10. **Channels:** website, phone, Instagram, WhatsApp, Divar, garage referral.
11. **Catalogue:** brands, prices and vehicle compatibility are illustrative. Compatibility uses 3 size classes (50–55Ah, 60–66Ah, 70–74Ah).
12. **Technician logins:** only one of the 4 seeded technicians has an account (the demo TECHNICIAN user).
13. Money is stored as BigInt Rial and sent in JSON as a decimal string. The UI shows Toman (÷10).
14. **Anonymous orders are website orders.** Office staff may set the channel (e.g. PHONE). Branch staff can only create orders for districts their branch serves.
15. **Core credit at installation** uses the battery's current `coreCreditRial`, not a snapshot taken at order time.
16. **Public catalogue shows only in stock / out of stock**, not unit counts. Counts are in `inventory/stock` for staff.
17. **Reports** cover orders *created* in the date range (Tehran days). Revenue = PAID payments of those orders, so every breakdown adds up to the KPIs.
18. **Order tracking** is public with order number + customer phone, and returns a reduced view.
