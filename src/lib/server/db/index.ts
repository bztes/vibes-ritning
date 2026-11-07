import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { dev } from '$app/env';
import { DATABASE_URL } from '$app/env/private';

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

// make sure the directory for a local SQLite file exists (e.g. a fresh /data volume)
if (DATABASE_URL.startsWith('file:')) {
	mkdirSync(dirname(DATABASE_URL.slice('file:'.length)), { recursive: true });
}

const client = createClient({ url: DATABASE_URL });
await client.execute('PRAGMA foreign_keys = ON');

export const db = drizzle(client, { schema });

// production applies pending migrations on startup (generated with `pnpm db:generate`);
// in development the schema is synced with `pnpm db:push` instead
if (!dev) await migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR ?? 'drizzle' });
