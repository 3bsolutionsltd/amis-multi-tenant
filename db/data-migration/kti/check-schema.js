// Temporary schema check — run once then delete
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='app' AND table_name='payments'
  ORDER BY ordinal_position
`).then(r => {
  r.rows.forEach(x => console.log(x.column_name, x.data_type));
  pool.end();
});
