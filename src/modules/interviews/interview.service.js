const repo = require('./interview.repository');
const applicationRepo = require('../applications/application.repository');
const ApiError = require('../../shared/errors/ApiError');
const { validateCreateInterview } = require('./interview.validator');
const {
  applyFilters, applySort, applyFields, buildMeta,
} = require('../../shared/query/listQuery');

const FILTER_HANDLERS = {
  applicationId: (i, v) => i.applicationId === v,
  outcome: (i, v) => i.outcome === v,
  round: (i, v) => i.round === Number(v),
};

async function listInterviews(q) {
  const all = await repo.findAll();
  let result = applyFilters(all, q.filters, FILTER_HANDLERS);
  result = applySort(result, q.sort);

  const total = result.length;
  const items = applyFields(result.slice(q.offset, q.offset + q.limit), q.fields);
  return { items, total };
}

async function getInterview(id) {
  const iv = await repo.findById(id);
  if (!iv) throw ApiError.notFound(`Interview with id ${id} was not found`);
  return iv;
}

async function createInterview(body) {
  const errors = validateCreateInterview(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  // Application must exist
  const application = await applicationRepo.findById(body.applicationId);
  if (!application) {
    throw ApiError.badRequest(`applicationId ${body.applicationId} does not exist`);
  }

  // INV-8: Interview.round unique per Application
  const round = Number(body.round);
  const duplicate = await repo.findByApplicationAndRound(body.applicationId, round);
  if (duplicate) {
    throw ApiError.conflict(`Round ${round} already exists for application ${body.applicationId}`);
  }

  const now = new Date().toISOString();
  return repo.create({
    id: `int_${Date.now()}`,
    applicationId: body.applicationId,
    round,
    scheduledAt: body.scheduledAt,
    outcome: body.outcome ?? 'pending',
    createdAt: now,
    updatedAt: now,
  });
}

function buildListMeta(q, total) {
  return buildMeta({ page: q.page, limit: q.limit, total, sort: q.sort, filters: q.filters });
}

module.exports = { listInterviews, getInterview, createInterview, buildListMeta };
