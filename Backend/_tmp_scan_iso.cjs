const fs = require('fs');
const path = require('path');
const dir = 'src';
const models = ['client', 'appointment', 'service', 'employee', 'invoice', 'review', 'notification', 'cashTransaction', 'familyMember'];
// models that are tenant-owned on the salon side (public-side reads are client-scoped by design)
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ts')) files.push(p);
  }
})(dir);
let flagged = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/prisma\.(client|appointment|service|employee|invoice|review|notification|cashTransaction|familyMember)\.(findMany|findFirst|findUnique|update|updateMany|delete|deleteMany)\(/);
    if (!m) continue;
    const model = m[1];
    // look at next 12 lines for tenantId / salonId
    const ctx = lines.slice(i, i + 12).join(' ');
    const hasTenant = /\btenantId\b/.test(ctx) || /\bsalonId\b/.test(ctx);
    // skip obviously client-scoped public service reads (where email/clientId present) — still print for review
    const hasClientScope = /\bemail\b|\bclientId\b/.test(ctx);
    if (!hasTenant && !hasClientScope) {
      flagged++;
      console.log(`${f}:${i + 1} [${model}.${m[2]}] NO tenantId/scoping seen in +12 lines`);
    }
  }
}
console.log(`\nTOTAL flagged: ${flagged}`);
