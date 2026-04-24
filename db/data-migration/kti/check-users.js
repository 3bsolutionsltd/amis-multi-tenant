'use strict';
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:password123@localhost:5432/amis_multi_tenant?sslmode=disable' });

pool.query(
  `SELECT id, tenant_id, email, role, is_active, (password_hash IS NOT NULL) as has_password
   FROM platform.users
   WHERE tenant_id = '2cd4a8e5-c648-4881-aaf5-45dfdc2c4f7b'
   ORDER BY role`
).then(r => {
  console.log(JSON.stringify(r.rows, null, 2));
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
