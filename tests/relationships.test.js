const { prisma, truncateAll } = require('./helpers');

async function seedStudent(overrides = {}) {
  return prisma.student.create({
    data: {
      name: 'S', email: `s-${Date.now()}-${Math.random()}@x.edu`,
      branch: 'CS', graduationYear: 2027, cgpa: 8.0,
      ...overrides,
    },
  });
}

async function seedCompanyAndJob({ openings = 3 } = {}) {
  const company = await prisma.company.create({
    data: { name: `Co-${Date.now()}-${Math.random()}`, industry: 'X', city: 'Y' },
  });
  const job = await prisma.job.create({
    data: {
      companyId: company.id, title: 'T', city: 'Y',
      type: 'INTERNSHIP', openings, deadline: new Date('2027-12-31'),
    },
  });
  return { company, job };
}

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('referential integrity — create failures', () => {
  test('application to a non-existent job → P2003 FK violation', async () => {
    const s = await seedStudent();
    await expect(
      prisma.application.create({ data: { studentId: s.id, jobId: 'job_ghost' } })
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  test('job for a non-existent company → P2003 FK violation', async () => {
    await expect(
      prisma.job.create({
        data: {
          companyId: 'cmp_ghost', title: 'X', city: 'Pune',
          type: 'INTERNSHIP', deadline: new Date('2027-12-31'),
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  test('placement for a non-existent application → P2003', async () => {
    const s = await seedStudent();
    const { job } = await seedCompanyAndJob();
    await expect(
      prisma.placement.create({
        data: {
          studentId: s.id, jobId: job.id, applicationId: 'app_ghost',
          offeredCtcPaise: 100n, titleAtOffer: 'X',
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});

describe('cascade behaviour', () => {
  test('deleting an application removes its events (CASCADE) but leaves the student and job', async () => {
    const s = await seedStudent();
    const { job } = await seedCompanyAndJob();
    const app = await prisma.application.create({
      data: { studentId: s.id, jobId: job.id },
    });
    await prisma.applicationEvent.createMany({
      data: [
        { applicationId: app.id, toStatus: 'SUBMITTED' },
        { applicationId: app.id, fromStatus: 'SUBMITTED', toStatus: 'UNDER_REVIEW' },
      ],
    });
    expect(await prisma.applicationEvent.count({ where: { applicationId: app.id } })).toBe(2);

    await prisma.application.delete({ where: { id: app.id } });

    expect(await prisma.applicationEvent.count({ where: { applicationId: app.id } })).toBe(0);
    expect(await prisma.student.findUnique({ where: { id: s.id } })).not.toBeNull();
    expect(await prisma.job.findUnique({ where: { id: job.id } })).not.toBeNull();
  });

  test('deleting a user cascades to refresh_tokens', async () => {
    const user = await prisma.user.create({
      data: {
        email: `u-${Date.now()}@x.edu`, passwordHash: 'x',
        passwordChangedAt: new Date(),
      },
    });
    await prisma.refreshToken.create({
      data: {
        userId: user.id, tokenHash: `hash-${Date.now()}`, family: 'fam',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    const remaining = await prisma.refreshToken.count({ where: { userId: user.id } });
    expect(remaining).toBe(0);
  });
});

describe('restrict behaviour — user-visible parents cannot silently vanish', () => {
  test('cannot delete a company with jobs (P2003 from RESTRICT)', async () => {
    const { company } = await seedCompanyAndJob();
    await expect(
      prisma.company.delete({ where: { id: company.id } })
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  test('cannot delete a job with applications', async () => {
    const s = await seedStudent();
    const { job } = await seedCompanyAndJob();
    await prisma.application.create({ data: { studentId: s.id, jobId: job.id } });
    await expect(prisma.job.delete({ where: { id: job.id } })).rejects.toThrow();
  });

  test('cannot delete a student with applications', async () => {
    const s = await seedStudent();
    const { job } = await seedCompanyAndJob();
    await prisma.application.create({ data: { studentId: s.id, jobId: job.id } });
    await expect(prisma.student.delete({ where: { id: s.id } })).rejects.toThrow();
  });
});

describe('uniqueness across relationships', () => {
  test('a student cannot apply to the same job twice (composite UNIQUE)', async () => {
    const s = await seedStudent();
    const { job } = await seedCompanyAndJob();
    await prisma.application.create({ data: { studentId: s.id, jobId: job.id } });
    await expect(
      prisma.application.create({ data: { studentId: s.id, jobId: job.id } })
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  test('a student cannot be placed twice (1:1 via @unique on studentId)', async () => {
    const s = await seedStudent();
    const { job } = await seedCompanyAndJob();
    const app1 = await prisma.application.create({
      data: { studentId: s.id, jobId: job.id, status: 'OFFERED' },
    });
    await prisma.placement.create({
      data: {
        studentId: s.id, jobId: job.id, applicationId: app1.id,
        offeredCtcPaise: 42_000_000n, titleAtOffer: 'A',
      },
    });

    const { job: job2 } = await seedCompanyAndJob();
    const app2 = await prisma.application.create({
      data: { studentId: s.id, jobId: job2.id, status: 'OFFERED' },
    });
    await expect(
      prisma.placement.create({
        data: {
          studentId: s.id, jobId: job2.id, applicationId: app2.id,
          offeredCtcPaise: 50_000_000n, titleAtOffer: 'B',
        },
      })
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
