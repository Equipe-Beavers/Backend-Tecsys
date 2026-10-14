// Read-only database assertion helper for the opt-in Flutter integration test.
import { LocalEnvironment } from './LocalEnvironment.mjs';
LocalEnvironment.Load();
const id = Number(process.argv[2]);
if (!Number.isSafeInteger(id) || id < 1) throw new Error('ID inválido.');
const { pool } = await import('../src/database/pool.ts');
const { getInstallCriterionQuery } = await import('../src/database/queries.ts');
try {
  const { rows } = await pool.query(getInstallCriterionQuery, [id]);
  console.log(JSON.stringify(rows[0] ?? null));
} finally {
  await pool.end();
}
