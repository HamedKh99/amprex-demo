import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { attachDatabasePool } from '@vercel/functions';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * One pg pool per process. On Vercel each Function instance gets its own, so keep it small and
 * let idle connections go quickly; attachDatabasePool keeps a suspended instance alive until they
 * are closed (it does nothing outside Vercel).
 */
function createPool(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 5_000 });
  attachDatabasePool(pool);
  return pool;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg(createPool(config.getOrThrow<string>('DATABASE_URL')), {
        disposeExternalPool: true,
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
