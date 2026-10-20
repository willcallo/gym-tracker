import { connect, readSchema, assertAdditiveSchema } from './_db.mjs';

const schema = readSchema();
assertAdditiveSchema(schema);

const client = connect();
await client.connect();
try {
  // One transaction with an advisory lock, so two builds starting together (say a preview and
  // production) can't race on CREATE TABLE IF NOT EXISTS. Transaction-scoped, so it also works
  // through a pooler.
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(7342001)');
  await client.query(schema);
  await client.query('COMMIT');
  console.log('Schema is up to date.');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  throw e;
} finally {
  await client.end();
}
