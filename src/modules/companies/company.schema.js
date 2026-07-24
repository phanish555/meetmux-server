const { z } = require('zod');
const p = require('../../shared/schemas/primitives');

const SORTABLE = ['name', 'employeeCount', 'createdAt'];

const list = {
  query: p.pagination.extend({
    industry: p.shortText(120).optional(),
    verified: p.boolFromQuery.optional(),
    location: p.shortText(120).optional(),
    search: p.shortText(100).optional(),
    sort: p.sortBy(SORTABLE),
    fields: z.string().max(500).optional(),
  }).strict(),
};

const getOne = {
  params: z.object({ id: p.companyId }).strict(),
};

const create = {
  body: z.object({
    name: p.shortText(200),
    industry: p.shortText(120),
    location: p.shortText(120),
    employeeCount: p.positiveInt.optional(),
    verified: z.boolean().optional(),
  }).strict(),
};

const update = {
  params: z.object({ id: p.companyId }).strict(),
  body: z.object({
    name: p.shortText(200).optional(),
    industry: p.shortText(120).optional(),
    location: p.shortText(120).optional(),
    employeeCount: p.positiveInt.optional(),
    verified: z.boolean().optional(),
  }).strict().refine(
    (b) => Object.keys(b).length > 0,
    { message: 'At least one field must be provided' },
  ),
};

const listJobs = {
  params: z.object({ id: p.companyId }).strict(),
  query: p.pagination.extend({
    type: p.jobType.optional(),
    sort: p.sortBy(['createdAt', 'deadline', 'stipend', 'title']),
  }).strict(),
};

module.exports = { list, getOne, create, update, listJobs };
