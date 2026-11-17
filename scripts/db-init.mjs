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
  // CREATE TABLE IF NOT EXISTS leaves an existing table alone, so a database from before user
  // accounts would keep its old shape and fail later on a confusing index error. Stop here instead.
  const { rows: old } = await client.query(
    `SELECT 1 FROM information_schema.tables t
     WHERE t.table_schema = current_schema() AND t.table_name = 'sessions'
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns c
         WHERE c.table_schema = t.table_schema AND c.table_name = 'sessions' AND c.column_name = 'user_id'
       )`
  );
  if (old.length) {
    console.error(
      'This database has tables from before user accounts (sessions has no user_id column). ' +
        'They cannot be upgraded in place. Run `ALLOW_RESET=yes npm run db:reset` against it once, ' +
        'which deletes all data, then deploy again.'
    );
    process.exit(1);
  }
  await client.query(schema);
  await client.query('COMMIT');
  console.log('Schema is up to date.');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  throw e;
} finally {
  await client.end();
}
