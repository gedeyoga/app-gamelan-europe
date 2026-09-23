require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const roles = await p.role.findMany({
    select: { name: true, code: true, _count: { select: { rolePermissions: true } } },
    orderBy: { name: 'asc' },
  });
  const totalPerms = await p.permission.count();
  const allCodes = (await p.permission.findMany({ select: { code: true } })).map(x => x.code);
  const assigned = await p.rolePermission.findMany({
    select: { role: { select: { name: true } }, permission: { select: { code: true } } },
  });
  const byRole = {};
  for (const a of assigned) (byRole[a.role.name] ??= []).push(a.permission.code);

  console.log('=== ROLES (name | code | permCount) ===');
  for (const r of roles) console.log(`${r.name} | ${r.code} | ${r._count.rolePermissions}`);
  console.log('=== TOTAL PERMISSIONS ===', totalPerms);
  console.log('=== TOTAL ROLE_PERMISSION ROWS ===', assigned.length);
  console.log('=== ALL PERMISSION CODES (sorted) ===');
  console.log(JSON.stringify([...allCodes].sort(), null, 0));
  for (const name of ['admin', 'organization', 'member']) {
    console.log(`=== ROLE ${name} (${(byRole[name] || []).length}) ===`);
    console.log(JSON.stringify([...(byRole[name] || [])].sort(), null, 0));
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
