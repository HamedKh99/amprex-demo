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
