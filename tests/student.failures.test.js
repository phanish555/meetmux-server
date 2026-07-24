const studentRepo = require('../src/modules/students/student.db.repository');
const { prisma, truncateAll, seedStudent } = require('./helpers');

const valid = {
  name: 'X', email: 'x@example.edu', branch: 'CS',
  graduationYear: 2026, cgpa: 8.5, skills: [],
};

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('constraints reject bad writes', () => {
  test('duplicate email → P2002', async () => {
    await studentRepo.create(valid);
    await expect(studentRepo.create(valid))
      .rejects.toMatchObject({ code: 'P2002' });
  });

  test('CGPA above 10 → CHECK constraint violation (Postgres 23514)', async () => {
    await expect(studentRepo.create({ ...valid, cgpa: 47 }))
      .rejects.toThrow(/chk_students_cgpa|check constraint|Value/i);
  });

  test('malformed email → CHECK regex rejection', async () => {
    await expect(studentRepo.create({ ...valid, email: 'not-an-email' }))
      .rejects.toThrow(/chk_students_email_format|check constraint|Value/i);
  });

  test('updating a non-existent record → P2025', async () => {
    await expect(studentRepo.update('does_not_exist', { branch: 'X' }))
      .rejects.toMatchObject({ code: 'P2025' });
  });

  test('application to a non-existent job → P2003 FK violation', async () => {
    const s = await seedStudent();
    await expect(
      prisma.application.create({ data: { studentId: s.id, jobId: 'nope' } })
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
