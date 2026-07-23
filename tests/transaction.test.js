const applicationService = require('../src/modules/applications/application.service');
const { prisma, truncateAll, seedCompanyAndJob, seedStudent } = require('./helpers');

beforeEach(truncateAll);
afterAll(() => prisma.$disconnect());

describe('transactional integrity', () => {
  test('mid-transaction failure rolls back the successful insert', async () => {
    const { job } = await seedCompanyAndJob();
    const student = await seedStudent();

    const beforeApps = await prisma.application.count();
    const beforeEvents = await prisma.applicationEvent.count();

    // Force a failure AFTER the first insert by writing a bogus enum value
    await expect(
      prisma.$transaction(async (tx) => {
        const app = await tx.application.create({
          data: { studentId: student.id, jobId: job.id },
        });
        // This will throw — the enum has no NOT_A_REAL_STATUS
        await tx.applicationEvent.create({
          data: { applicationId: app.id, toStatus: 'NOT_A_REAL_STATUS' },
        });
      })
    ).rejects.toThrow();

    // Nothing persisted — not even the first insert
    expect(await prisma.application.count()).toBe(beforeApps);
    expect(await prisma.applicationEvent.count()).toBe(beforeEvents);
  });

  test('acceptOffer atomically: accepts, withdraws siblings, marks student PLACED, decrements openings', async () => {
    const { company, job: acceptedJob } = await seedCompanyAndJob({ openings: 2 });
    const otherJob1 = await prisma.job.create({
      data: {
        companyId: company.id, title: 'Other 1', city: 'Bengaluru',
        type: 'INTERNSHIP', openings: 1, deadline: new Date('2027-12-31'),
      },
    });
    const otherJob2 = await prisma.job.create({
      data: {
        companyId: company.id, title: 'Other 2', city: 'Bengaluru',
        type: 'FULL_TIME', openings: 1, deadline: new Date('2027-12-31'),
      },
    });
    const student = await seedStudent();

    // Set up: student has 3 live applications; one is offered
    const acceptedApp = await prisma.application.create({
      data: { studentId: student.id, jobId: acceptedJob.id, status: 'OFFERED' },
    });
    await prisma.application.create({
      data: { studentId: student.id, jobId: otherJob1.id, status: 'UNDER_REVIEW' },
    });
    await prisma.application.create({
      data: { studentId: student.id, jobId: otherJob2.id, status: 'SHORTLISTED' },
    });

    const result = await applicationService.acceptOffer(acceptedApp.id);
    expect(result.withdrawnCount).toBe(2);

    // Siblings are withdrawn
    const withdrawn = await prisma.application.count({
      where: { studentId: student.id, status: 'WITHDRAWN' },
    });
    expect(withdrawn).toBe(2);

    // Student marked PLACED
    const refreshed = await prisma.student.findUnique({ where: { id: student.id } });
    expect(refreshed.status).toBe('PLACED');

    // Openings on the accepted job decremented (from 2 → 1)
    const jobAfter = await prisma.job.findUnique({ where: { id: acceptedJob.id } });
    expect(jobAfter.openings).toBe(1);
  });
});
