const prisma = require('../../shared/prisma');

const STATUS_TO_API = {
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under-review',
  SHORTLISTED: 'shortlisted',
  REJECTED: 'rejected',
  OFFERED: 'offered',
  WITHDRAWN: 'withdrawn',
};

const STATUS_TO_DB = {
  'submitted': 'SUBMITTED',
  'under-review': 'UNDER_REVIEW',
  'shortlisted': 'SHORTLISTED',
  'rejected': 'REJECTED',
  'offered': 'OFFERED',
  'withdrawn': 'WITHDRAWN',
};

function toDomain(a) {
  if (!a) return null;
  return {
    id: a.id,
    studentId: a.studentId,
    jobId: a.jobId,
    status: STATUS_TO_API[a.status],
    appliedAt: a.appliedAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    withdrawnAt: a.withdrawnAt ? a.withdrawnAt.toISOString() : null,
    idempotencyKey: a.idempotencyKey || null,
  };
}

module.exports = {
  findAll: async () => {
    const rows = await prisma.application.findMany({ orderBy: { appliedAt: 'desc' } });
    return rows.map(toDomain);
  },

  findById: async (id) => {
    const row = await prisma.application.findUnique({ where: { id } });
    return toDomain(row);
  },

  findByStudentAndJob: async (studentId, jobId) => {
    const row = await prisma.application.findUnique({
      where: { uq_application_student_job: { studentId, jobId } },
    });
    return toDomain(row);
  },

  findByIdempotencyKey: async (key) => {
    if (!key) return null;
    const row = await prisma.application.findUnique({ where: { idempotencyKey: key } });
    return toDomain(row);
  },

  create: async (application) => {
    // Wrap create + first audit event in a transaction — all or nothing
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          studentId: application.studentId,
          jobId: application.jobId,
          status: STATUS_TO_DB[application.status] || 'SUBMITTED',
          idempotencyKey: application.idempotencyKey || null,
        },
      });
      await tx.applicationEvent.create({
        data: {
          applicationId: created.id,
          fromStatus: null,
          toStatus: created.status,
        },
      });
      return created;
    });
    return toDomain(row);
  },

  update: async (id, patch) => {
    const data = {};
    if (patch.status !== undefined) data.status = STATUS_TO_DB[patch.status] || patch.status;
    if (patch.withdrawnAt !== undefined) {
      data.withdrawnAt = patch.withdrawnAt ? new Date(patch.withdrawnAt) : null;
    }

    // If status is changing, atomically write the audit event
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.application.findUnique({ where: { id } });
      const updated = await tx.application.update({ where: { id }, data });
      if (data.status && before && before.status !== updated.status) {
        await tx.applicationEvent.create({
          data: {
            applicationId: id,
            fromStatus: before.status,
            toStatus: updated.status,
          },
        });
      }
      return updated;
    });
    return toDomain(row);
  },

  reset: async () => {},
};
