// Dumps every foreign key + its ON DELETE rule from information_schema.
// Task 8 pitfall 1 — verify no FK silently defaulted to NO ACTION.

const prisma = require('../src/shared/prisma');

(async () => {
  const rows = await prisma.$queryRaw`
    SELECT
      tc.table_name  AS "from_table",
      kcu.column_name AS "from_column",
      ccu.table_name  AS "to_table",
      rc.delete_rule  AS "on_delete"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `;

  console.log('\nForeign keys and ON DELETE behaviour:\n');
  console.table(rows.map((r) => ({
    from: `${r.from_table}.${r.from_column}`,
    to: r.to_table,
    on_delete: r.on_delete,
  })));

  const suspicious = rows.filter((r) => r.on_delete === 'NO ACTION');
  if (suspicious.length) {
    console.log('\n⚠  FKs with NO ACTION (Prisma default when onDelete was not specified):');
    for (const s of suspicious) console.log(`  ${s.from_table}.${s.from_column} → ${s.to_table}`);
    process.exit(1);
  }
  console.log('\n✓ Every FK has a deliberate ON DELETE rule.');
  await prisma.$disconnect();
})();
