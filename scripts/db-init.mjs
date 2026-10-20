import { connect, applySchema } from './_db.mjs';

const client = connect();
await client.connect();
try {
  await applySchema(client);
  console.log('Schema is up to date.');
} finally {
  await client.end();
}
