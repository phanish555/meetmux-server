const prisma = require('../../shared/prisma');

const OUTCOME_TO_API = { PENDING: 'pending', PASSED: 'passed', FAILED: 'failed' };
const OUTCOME_TO_DB = { pending: 'PENDING', passed: 'PASSED', failed: 'FAILED' };

function toDomain(i) {
  if (!i) return null;
  return {
    id: i.id,
    applicationId: i.applicationId,
    round: i.round,
    scheduledAt: i.scheduledAt.toISOString(),
    outcome: OUTCOME_TO_API[i.outcome],
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

module.exports = {
  findAll: async (client = prisma) => {
    const rows = await client.interview.findMany({ orderBy: { scheduledAt: 'desc' } });
    return rows.map(toDomain);
  },

  findById: async (id, client = prisma) => {
    const row = await client.interview.findUnique({ where: { id } });
    return toDomain(row);
  },

  findByApplicationAndRound: async (applicationId, round, client = prisma) => {
    const row = await client.interview.findUnique({
      where: { uq_interview_application_round: { applicationId, round } },
    });
    return toDomain(row);
  },

  create: async (interview, client = prisma) => {
    const row = await client.interview.create({
      data: {
        applicationId: interview.applicationId,
        round: interview.round,
        scheduledAt: new Date(interview.scheduledAt),
        outcome: OUTCOME_TO_DB[interview.outcome] || 'PENDING',
      },
    });
    return toDomain(row);
  },

  reset: async () => {},
};
