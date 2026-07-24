const { z } = require('zod');
const p = require('../../shared/schemas/primitives');

const SORTABLE = ['name', 'cgpa', 'graduationYear', 'createdAt'];

const list = {
  query: p.pagination.extend({
    status: p.studentStatus.optional(),
    branch: p.shortText(120).optional(),
    graduationYear: p.graduationYear.optional(),
    skill: p.shortText(60).optional(),
    search: p.shortText(100).optional(),
    sort: p.sortBy(SORTABLE),
    fields: z.string().max(500).optional(),
  }).strict(),
};

const getOne = {
  params: z.object({ id: p.studentId }).strict(),
};

const create = {
  body: z.object({
    name: p.personName,
    email: p.email,
    branch: p.shortText(120),
    graduationYear: p.graduationYear,
    cgpa: p.cgpa.optional(),
    skills: z.array(p.shortText(60)).max(30).optional(),
    status: p.studentStatus.optional(),
    // `role`/`emailVerified` etc deliberately excluded — mass-assignment defence
  }).strict(),
};

const update = {
  params: z.object({ id: p.studentId }).strict(),
  body: z.object({
    name: p.personName.optional(),
    branch: p.shortText(120).optional(),
    graduationYear: p.graduationYear.optional(),
    cgpa: p.cgpa.optional(),
    skills: z.array(p.shortText(60)).max(30).optional(),
    status: p.studentStatus.optional(),
    // email deliberately excluded — email changes need verification
  }).strict().refine(
    (b) => Object.keys(b).length > 0,
    { message: 'At least one field must be provided' },
  ),
};

const listApplications = {
  params: z.object({ id: p.studentId }).strict(),
  query: p.pagination.extend({
    status: p.applicationStatus.optional(),
    sort: p.sortBy(['appliedAt', 'updatedAt', 'status']),
  }).strict(),
};

module.exports = { list, getOne, create, update, listApplications };
