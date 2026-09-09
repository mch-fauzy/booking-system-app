import 'server-only';
import './force-ipv4';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { config } from '@/shared/config';
import * as schema from '@/shared/db/schema';

// neon-http has no interactive transactions; the confirm step needs a row lock inside one.
neonConfig.webSocketConstructor = ws;

// >= 2 so the last-seat race test runs two transactions concurrently.
const POOL_MAX = 5;
const pool = new Pool({ connectionString: config.database.url, max: POOL_MAX });
export const db = drizzle({ client: pool, schema });

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Caller's transaction when inside one, the pool otherwise.
export function conn(tx?: DbTransaction) {
  return tx ?? db;
}
