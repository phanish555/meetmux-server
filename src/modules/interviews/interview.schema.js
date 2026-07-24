const { z } = require('zod');
const p = require('../../shared/schemas/primitives');

const SORTABLE = ['scheduledAt', 'round', 'createdAt'];

const list = {
  query: p.pagination.extend({
    applicationId: p.applicationId.optional(),
    outcome: p.interviewOutcome.optional(),
    round: z.coerce.number().int().min(1).optional(),
    sort: p.sortBy(SORTABLE),
    fields: z.string().max(500).optional(),
  }).strict(),
};

const getOne = {
  params: z.object({ id: p.interviewId }).strict(),
};

const create = {
  body: z.object({
    applicationId: p.applicationId,
    round: z.coerce.number().int().min(1).max(20),
    scheduledAt: p.isoDate,
    outcome: p.interviewOutcome.optional(),
  }).strict(),
};

module.exports = { list, getOne, create };
