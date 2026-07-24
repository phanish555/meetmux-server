const { z } = require('zod');
const p = require('../../shared/schemas/primitives');

const SORTABLE = ['appliedAt', 'updatedAt', 'status'];

const list = {
  query: p.pagination.extend({
    studentId: p.studentId.optional(),
    jobId: p.jobId.optional(),
    status: p.applicationStatus.optional(),
    sort: p.sortBy(SORTABLE),
    fields: z.string().max(500).optional(),
  }).strict(),
};

const getOne = {
  params: z.object({ id: p.applicationId }).strict(),
};

const create = {
  // Idempotency-Key is optional; other headers ignored (Express passes them all)
  headers: z.object({
    'idempotency-key': z.string().min(1).max(100).optional(),
  }).passthrough(),
  body: z.object({
    // studentId is enforced from the caller's identity in the service for
    // STUDENT role, but ADMIN can pass one explicitly.
    studentId: p.studentId.optional(),
    jobId: p.jobId,
  }).strict(),
};

const patchStatus = {
  params: z.object({ id: p.applicationId }).strict(),
  body: z.object({
    status: p.applicationStatus,
  }).strict(),
};

const withdraw = {
  params: z.object({ id: p.applicationId }).strict(),
};

const listInterviews = {
  params: z.object({ id: p.applicationId }).strict(),
  query: p.pagination.extend({
    outcome: p.interviewOutcome.optional(),
    sort: p.sortBy(['scheduledAt', 'round', 'createdAt']),
  }).strict(),
};

module.exports = { list, getOne, create, patchStatus, withdraw, listInterviews };
