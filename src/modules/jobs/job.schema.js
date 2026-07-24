const { z } = require('zod');
const p = require('../../shared/schemas/primitives');

const SORTABLE = ['createdAt', 'deadline', 'stipend', 'title'];

const list = {
  query: p.pagination.extend({
    companyId: p.companyId.optional(),
    type: p.jobType.optional(),
    location: p.shortText(120).optional(),
    minStipend: p.nonNegativeInt.optional(),
    skill: p.shortText(60).optional(),
    search: p.shortText(100).optional(),
    sort: p.sortBy(SORTABLE),
    fields: z.string().max(500).optional(),
  }).strict(),
};

const getOne = {
  params: z.object({ id: p.jobId }).strict(),
  query: z.object({
    expand: z.enum(['company']).optional(),
  }).strict(),
};

const create = {
  body: z.object({
    companyId: p.companyId,
    title: p.shortText(200),
    location: p.shortText(120),
    type: p.jobType,
    stipend: p.nonNegativeInt.nullish(),
    skills: z.array(p.shortText(60)).max(30).optional(),
    openings: z.coerce.number().int().min(1).max(1000).optional(),
    deadline: p.futureDate,
  }).strict(),
};

const update = {
  params: z.object({ id: p.jobId }).strict(),
  body: z.object({
    title: p.shortText(200).optional(),
    location: p.shortText(120).optional(),
    type: p.jobType.optional(),
    stipend: p.nonNegativeInt.nullish(),
    skills: z.array(p.shortText(60)).max(30).optional(),
    openings: z.coerce.number().int().min(1).max(1000).optional(),
    deadline: p.futureDate.optional(),
  }).strict().refine(
    (b) => Object.keys(b).length > 0,
    { message: 'At least one field must be provided' },
  ),
};

const listApplications = {
  params: z.object({ id: p.jobId }).strict(),
  query: p.pagination.extend({
    status: p.applicationStatus.optional(),
    sort: p.sortBy(['appliedAt', 'updatedAt', 'status']),
  }).strict(),
};

module.exports = { list, getOne, create, update, listApplications };
