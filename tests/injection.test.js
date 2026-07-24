const studentRepo = require('../src/modules/students/student.db.repository');
const { prisma, truncateAll } = require('./helpers');

const valid = {
  name: 'Aarav', email: 'aarav.sharma@example.edu',
  branch: 'CSE', graduationYear: 2026, cgpa: 8.5, skills: [],
};

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

const payloads = [
  "' OR '1'='1",
  "x'; DROP TABLE students; --",
  "' UNION SELECT * FROM students --",
  "admin'--",
  "'; UPDATE students SET cgpa = 10; --",
];

describe('SQL injection payloads are inert (Prisma parameterises inputs)', () => {
  test.each(payloads)('payload %s → 0 rows, no mutation', async (payload) => {
    await studentRepo.create(valid);
    const before = await prisma.student.count();

    const found = await studentRepo.findByEmail(payload);
    expect(found).toBeNull();

    // Table still exists, count unchanged, values unchanged
    const after = await prisma.student.count();
    expect(after).toBe(before);
    const table = await prisma.$queryRaw`SELECT to_regclass('students')::text AS name`;
    expect(table[0].name).toBe('students');

    const still = await studentRepo.findByEmail('aarav.sharma@example.edu');
    expect(still).not.toBeNull();
    expect(still.cgpa).toBe(8.5);
  });
});
