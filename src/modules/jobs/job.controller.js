const service = require('./job.service');
const applicationService = require('../applications/application.service');
const applicationDto = require('../applications/application.dto');
const applicationQuerySchema = require('../applications/application.queryschema');
const querySchema = require('./job.queryschema');
const dto = require('./job.dto');
const { parseQuery } = require('../../shared/query/queryParser');
const { success } = require('../../shared/http/apiResponse');
const asyncHandler = require('../../shared/http/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, querySchema);
  const { items, total } = await service.listJobs(q);
  return success(res, {
    data: dto.toPublicList(items),
    meta: service.buildListMeta(q, total),
  });
});

const getById = asyncHandler(async (req, res) => {
  const job = await service.getJob(req.params.id, { expand: req.query.expand });
  return success(res, { data: dto.toPublic(job) });
});

const create = asyncHandler(async (req, res) => {
  const job = await service.createJob(req.body);
  res.setHeader('Location', `/api/v1/jobs/${job.id}`);
  return success(res, { data: dto.toPublic(job), status: 201 });
});

const update = asyncHandler(async (req, res) => {
  const job = await service.updateJob(req.params.id, req.body);
  return success(res, { data: dto.toPublic(job) });
});

const listApplicationsForJob = asyncHandler(async (req, res) => {
  await service.getJob(req.params.id); // 404 if missing
  const q = parseQuery(req.query, applicationQuerySchema);
  const nested = { ...q, filters: { ...q.filters, jobId: req.params.id } };
  const { items, total } = await applicationService.listApplications(nested);
  return success(res, {
    data: applicationDto.toPublicList(items),
    meta: applicationService.buildListMeta(nested, total),
  });
});

module.exports = { list, getById, create, update, listApplicationsForJob };
