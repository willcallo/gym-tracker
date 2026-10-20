import { connect, applySchema } from './_db.mjs';

// Drops every table this app has ever used (old and new shapes), then recreates the schema.
const TABLES = ['sets', 'sessions', 'exercises', 'settings', 'training_summary', 'user_settings', 'dashboard_cache'];

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
