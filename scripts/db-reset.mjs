import { connect, applySchema } from './_db.mjs';

// Drops every table this app has ever used (old and new shapes), then recreates the schema.
const TABLES = ['sets', 'sessions', 'exercises', 'settings', 'training_summary', 'ai_usage', 'user_settings', 'dashboard_cache',
  // Auth tables. Quoted: "user" is a reserved word and Better Auth's names are case-sensitive.
  '"rateLimit"', '"verification"', '"account"', '"session"', '"user"'];

// Wiping a remote database by accident (say, after pulling production env vars) is the one
// mistake this script must not allow. Local databases are fine; anything else needs ALLOW_RESET=yes.
const target = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';
let host = '';
try {
  host = new URL(target).hostname;
} catch {
  // connect() reports a missing or invalid URL
}
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]', ''].includes(host);
if (!isLocal && process.env.ALLOW_RESET !== 'yes') {
  console.error(
    `Refusing to reset ${host}: it is not a local database. If you really mean it, run ` +
      '`ALLOW_RESET=yes npm run db:reset`.'
  );
  process.exit(1);
}

const client = connect();
await client.connect();
try {
  await client.query('BEGIN');
  for (const t of TABLES) await client.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
  await applySchema(client);
  await client.query('COMMIT');
  console.log('Dropped all app tables and recreated the schema. Run `npm run db:seed` for sample data.');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
