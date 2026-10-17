import { execSync } from 'node:child_process';

/**
 * Brings the e2e database to the latest migration and loads the demo seed (which wipes the
 * seeded tables first), so every run starts from the same data. Point E2E_DATABASE_URL only
 * at a disposable database.
 */
export default function setup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error('Set E2E_DATABASE_URL to a disposable database (its data is replaced).');
  // Override the unpooled URL too: prisma.config.ts prefers it, and a leftover value must never
  // send this reset to another database.
  const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url };
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
  execSync('npx prisma db seed', { stdio: 'inherit', env });
}
