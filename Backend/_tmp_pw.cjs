const path = require('path');
require('dotenv').config({ path: path.resolve('.env') });
const { PrismaClient } = require('./node_modules/.prisma/client/default.js');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const B = 'http://localhost:5000';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
(async () => {
  const email = `pwtest${Date.now()}@test.reza`;
  const client = await prisma.client.create({
    data: { email, firstName: 'PW', lastName: 'Test', phone: '+212600000000',
      password: await bcrypt.hash('oldpass123', 10),
      resetPasswordToken: sha('123456'), resetPasswordExpires: new Date(Date.now() + 3600e3) },
  });
  console.log('seeded:', client.id);
  const r = await fetch(`${B}/api/public/client/${encodeURIComponent(email)}/change-password`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '123456', newPassword: 'newpass123' }),
  });
  console.log('change-password:', r.status, await r.text());
  const l = await fetch(`${B}/api/public/auth/client-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'newpass123' }),
  });
  console.log('login new pw:', l.status, (await l.json()).error || 'OK');
  await prisma.client.delete({ where: { id: client.id } });
  console.log('cleaned up');
  await pool.end();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
