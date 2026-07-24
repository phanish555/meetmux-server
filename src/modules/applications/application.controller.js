const service = require('./application.service');
const interviewService = require('../interviews/interview.service');
const interviewDto = require('../interviews/interview.dto');
const interviewQuerySchema = require('../interviews/interview.queryschema');
const querySchema = require('./application.queryschema');
const dto = require('./application.dto');
const { parseQuery } = require('../../shared/query/queryParser');
const { success } = require('../../shared/http/apiResponse');
const asyncHandler = require('../../shared/http/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, querySchema);
  const { items, total } = await service.listApplications(q, req.user);
  return success(res, {
    data: dto.toPublicList(items),
    meta: service.buildListMeta(q, total),
  });
});

const getById = asyncHandler(async (req, res) => {
  const app = await service.getApplication(req.params.id, req.user);
  return success(res, { data: dto.toPublic(app) });
});

const create = asyncHandler(async (req, res) => {
  const key = req.get('Idempotency-Key');
  const { application, replayed } = await service.createApplication(req.body, key, req.user);
  if (!replayed) {
    res.setHeader('Location', `/api/v1/applications/${application.id}`);
  }
  return success(res, { data: dto.toPublic(application), status: replayed ? 200 : 201 });
});

const patchStatus = asyncHandler(async (req, res) => {
  const updated = await service.updateStatus(req.params.id, req.body);
  return success(res, { data: dto.toPublic(updated) });
});

const withdraw = asyncHandler(async (req, res) => {
  const updated = await service.withdrawApplication(req.params.id, req.user);
  res.setHeader('Location', `/api/v1/applications/${updated.id}`);
  return success(res, { data: dto.toPublic(updated), status: 201 });
});

const listInterviewsForApplication = asyncHandler(async (req, res) => {
  await service.getApplication(req.params.id, req.user); // 404 if missing or not owned
  const q = parseQuery(req.query, interviewQuerySchema);
  const nested = { ...q, filters: { ...q.filters, applicationId: req.params.id } };
  const { items, total } = await interviewService.listInterviews(nested);
  return success(res, {
    data: interviewDto.toPublicList(items),
    meta: interviewService.buildListMeta(nested, total),
  });
});

module.exports = { list, getById, create, patchStatus, withdraw, listInterviewsForApplication };
