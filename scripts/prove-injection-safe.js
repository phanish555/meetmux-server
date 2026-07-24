// Demonstrates that Prisma parameterises inputs — hostile payloads become
// literal search strings, never SQL.

const prisma = require('../src/shared/prisma');

const payloads = [
  "' OR '1'='1",
  "x'; DROP TABLE students; --",
  "' UNION SELECT id, name, email, branch FROM students --",
  "admin'--",
  "'; UPDATE students SET cgpa = 10; --",
  "' OR sleep(5) --",
];

(async () => {
  const beforeCount = await prisma.student.count();
  console.log(`Students before: ${beforeCount}\n`);

  for (const payload of payloads) {
    const rows = await prisma.student.findMany({ where: { email: payload } });
    const pad = payload.padEnd(60);
    const flag = rows.length === 0 ? '✓ inert' : '✗ LEAKED';
    console.log(`Payload: ${pad} → ${rows.length} rows  ${flag}`);
  }

  const afterCount = await prisma.student.count();
  const tableCheck = await prisma.$queryRaw`SELECT to_regclass('students')::text AS name`;
  const tableStillThere = tableCheck[0].name === 'students';

  console.log(`\nStudents after: ${afterCount}`);
  console.log(`students table still exists: ${tableStillThere}`);

  const ok = afterCount === beforeCount && tableStillThere;
  console.log(ok ? '\n✓ No injection succeeded.' : '\n✗ DATA CHANGED — investigate!');

  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
})();
