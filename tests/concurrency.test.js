const { prisma, truncateAll, seedCompanyAndJob, seedStudent } = require('./helpers');

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('concurrency', () => {
  test('5 simultaneous identical applications → exactly 1 succeeds (composite UNIQUE)', async () => {
    const { job } = await seedCompanyAndJob();
    const student = await seedStudent();

    const attempts = Array.from({ length: 5 }, () =>
      prisma.application.create({ data: { studentId: student.id, jobId: job.id } })
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);

    // Only one row in the DB
    const count = await prisma.application.count();
    expect(count).toBe(1);

    // All rejections are the composite UNIQUE violation
    for (const r of rejected) {
      expect(r.reason.code).toBe('P2002');
    }
  });

  test('atomic decrement never over-allocates openings (CHECK openings > 0)', async () => {
    const { job } = await seedCompanyAndJob({ openings: 3 });

    // 5 concurrent decrements. The DB CHECK is `openings > 0`, so decrement
    // rows must land at >= 1 — i.e. only 2 of the 5 can succeed (3→2→1).
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        prisma.job.update({
          where: { id: job.id },
          data: { openings: { decrement: 1 } },
        })
      )
    );

    const after = await prisma.job.findUnique({ where: { id: job.id } });
    expect(after.openings).toBe(1); // never below 1
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(3);
  });
});
