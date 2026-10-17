# AMPREX demo — project rules

Goal: a demo of the AMPREX operating core (battery sale + on-site installation, Tehran) that runs the
acceptance path: order → compatible battery → stock check → assignment → technician mission →
installed battery + core return (باتری داغی) → payment → completion → admin report.

Stack (pin exactly): Node 24, pnpm 10.34.7 workspaces, TypeScript 6.0.3, NestJS 12.1.3 (ESM, Vitest),
@nestjs/swagger 12.0.2, @nestjs/jwt 12.0.3, bcryptjs 3.0.3, @nestjs/throttler 6.7.1,
class-validator 0.15.1, Prisma 7.10.1 + @prisma/adapter-pg (generator "prisma-client"), PostgreSQL,
Next.js 16.4.2 + React 19.3.1 (App Router), Tailwind 4.3.3, shadcn 4.22.0 with --rtl,
@tanstack/react-query 5.104.3, @tanstack/react-table 8.21.3, react-hook-form 7.90.0 + zod 4.6.7,
recharts 3.10.1, lucide-react, sonner.

Layout: apps/api (Nest), apps/web (Next: (site) /, /admin, /tech), packages/shared (statuses,
Persian labels, roles, allowed transitions). Browser calls /api/* on the web origin; next.config
rewrites to API_URL.

Non-negotiables:

- All business rules live in apps/api. The UI never computes price, availability or transitions.
- Money is BigInt Rial in the DB; format as Toman only in the UI.
- Stock reserve = one conditional UPDATE inside the order transaction; 0 rows → 409 OUT_OF_STOCK.
- POST /orders requires Idempotency-Key; a duplicate returns the existing order.
- Every status change goes through OrderStateService.transition() and writes OrderEvent.
- Branch-scoped roles (BRANCH_MANAGER, OPERATOR, TECHNICIAN) only see their branch or own missions.
- Errors: { code, message(fa), details? }.
- UI text is formal Persian, RTL, Vazirmatn, Persian digits, Jalali dates via Intl (fa-IR-u-ca-persian).
- Every list has loading (skeleton), empty and error states.
- Unclear business rules are assumptions: put them in one config/seed place and list them in README.
- Small commits with conventional messages. Never commit secrets; provide .env.example.

First task: scaffold the workspace, write prisma/schema.prisma for the models in the plan,
a seed (2 branches, 12 vehicle models, 8 batteries, stock, 4 technicians, 6 channels, 4 slots,
40 past orders, 4 demo users), docker-compose for Postgres, and the Nest modules skeleton with
Swagger at /api/docs. Stop and show me the schema before writing services.
