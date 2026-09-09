import 'dotenv/config';
import './src/shared/lib/db/force-ipv4';
import { defineConfig } from 'drizzle-kit';

const unpooledUrl = process.env.DATABASE_URL_UNPOOLED;
if (!unpooledUrl) throw new Error('DATABASE_URL_UNPOOLED is required for migrations');

export default defineConfig({
  schema: './src/shared/db/schema.ts',
  out: './src/shared/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: unpooledUrl },
});
