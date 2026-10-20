import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  try {
    process.loadEnvFile(path.join(root, '.env.local'));
  } catch {
    // no .env.local, fall through to the error below
  }
}

// Schema scripts prefer the direct (unpooled) connection when there is one. Neon's Vercel
// integration sets DATABASE_URL_UNPOOLED next to the pooled DATABASE_URL.
export function connect() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set (export it or put it in .env.local).');
    process.exit(1);
  }
  return new pg.Client({ connectionString: url });
}

// db:init now runs on every Vercel build, production included, so it refuses anything that
// could destroy data. Destructive changes need a deliberate, manual migration instead.
export function assertAdditiveSchema(sql) {
  const code = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
  const bad = code.match(/\b(drop|truncate)\b|\bdelete\s+from\b/i);
  if (bad) {
    console.error(
      `lib/schema.sql contains "${bad[0]}". It runs automatically on every deploy, so it must only ` +
        'add things (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS). Refusing to run.'
    );
    process.exit(1);
  }
}

export function readSchema() {
  return fs.readFileSync(path.join(root, 'lib', 'schema.sql'), 'utf8');
}

export async function applySchema(client) {
  await client.query(readSchema());
}
