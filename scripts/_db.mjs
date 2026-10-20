import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(path.join(root, '.env.local'));
  } catch {
    // no .env.local, fall through to the error below
  }
}

export function connect() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (export it or put it in .env.local).');
    process.exit(1);
  }
  return new pg.Client({ connectionString: process.env.DATABASE_URL });
}

export function readSchema() {
  return fs.readFileSync(path.join(root, 'lib', 'schema.sql'), 'utf8');
}

export async function applySchema(client) {
  await client.query(readSchema());
}
