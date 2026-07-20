const repo = require('./job.repository');
const companyRepo = require('../companies/company.repository');
const ApiError = require('../../shared/errors/ApiError');
const { validateCreateJob, validateUpdateJob } = require('./job.validator');
const querySchema = require('./job.queryschema');
const {
  applyFilters, applySearch, applySort, applyFields, buildMeta,
} = require('../../shared/query/listQuery');

const FILTER_HANDLERS = {
  companyId: (j, v) => j.companyId === v,
  type: (j, v) => j.type === v,
  location: (j, v) => j.location.toLowerCase().includes(String(v).toLowerCase()),
  minStipend: (j, v) => j.stipend !== null && j.stipend >= Number(v),
  skill: (j, v) => j.skills.some((s) => s.toLowerCase() === String(v).toLowerCase()),
};

async function listJobs(q) {
  const all = await repo.findAll();
  let result = applyFilters(all, q.filters, FILTER_HANDLERS);
  result = applySearch(result, q.search, querySchema.searchable);
  result = applySort(result, q.sort);

  const total = result.length;
  const items = applyFields(result.slice(q.offset, q.offset + q.limit), q.fields);
  return { items, total };
}

async function getJob(id, { expand } = {}) {
  const job = await repo.findById(id);
  if (!job) throw ApiError.notFound(`Job with id ${id} was not found`);

  const wants = Array.isArray(expand) ? expand : (expand ? String(expand).split(',') : []);
  if (wants.includes('company')) {
    job.company = await companyRepo.findById(job.companyId);
  }
  return job;
}

async function createJob(body) {
  const errors = validateCreateJob(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  // INV-1: Job.companyId must reference an existing Company
  const company = await companyRepo.findById(body.companyId);
  if (!company) {
    throw ApiError.badRequest(`companyId ${body.companyId} does not exist`);
  }

  // INV-6: Job.deadline must be in the future at creation time
  if (new Date(body.deadline) <= new Date()) {
    throw ApiError.validation('deadline must be a future date', [
      { field: 'deadline', message: 'must be in the future' },
    ]);
  }

  const now = new Date().toISOString();
  return repo.create({
    id: `job_${Date.now()}`,
    companyId: body.companyId,
    title: body.title.trim(),
    location: body.location.trim(),
    type: body.type,
    stipend: body.stipend ?? null,
    skills: body.skills ?? [],
    openings: body.openings ?? 1,
    deadline: body.deadline,
    createdAt: now,
    updatedAt: now,
  });
}

async function updateJob(id, body) {
  const errors = validateUpdateJob(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  const job = await repo.findById(id);
  if (!job) throw ApiError.notFound(`Job with id ${id} was not found`);

  const patch = {};
  for (const k of ['title', 'location', 'type', 'stipend', 'skills', 'openings', 'deadline']) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (patch.title) patch.title = patch.title.trim();
  if (patch.location) patch.location = patch.location.trim();

  return repo.update(id, patch);
}

async function listJobsByCompany(companyId, q) {
  const company = await companyRepo.findById(companyId);
  if (!company) throw ApiError.notFound(`Company with id ${companyId} was not found`);

  const nested = { ...q, filters: { ...q.filters, companyId } };
  return listJobs(nested);
}

function buildListMeta(q, total) {
  return buildMeta({ page: q.page, limit: q.limit, total, sort: q.sort, filters: q.filters });
}

module.exports = { listJobs, getJob, createJob, updateJob, listJobsByCompany, buildListMeta };
