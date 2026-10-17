import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// One .env at the repo root serves the whole workspace; apps/api/.env may override.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrate/seed need a direct connection (advisory locks, long DDL), so prefer the non-pooled
    // URL when one is set (Neon). `prisma generate` needs no database; the fallback only lets it
    // run without a .env.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? 'postgresql://localhost:5432/amprex',
  },
});
