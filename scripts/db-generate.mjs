// Wraps `drizzle-kit generate` to REQUIRE an explicit snake_case --name.
// Usage: npm run db:generate -- --name create_bookings
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const nameIdx = args.indexOf('--name');
const name = nameIdx !== -1 ? args[nameIdx + 1] : undefined;

if (!name || !/^[a-z0-9]+(_[a-z0-9]+)*$/.test(name)) {
  console.error('Migration name required, e.g.: npm run db:generate -- --name create_bookings');
  process.exit(1);
}

const result = spawnSync('drizzle-kit', ['generate', ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);
