const service = require('./company.service');
const jobService = require('../jobs/job.service');
const jobDto = require('../jobs/job.dto');
const jobQuerySchema = require('../jobs/job.queryschema');
const querySchema = require('./company.queryschema');
const dto = require('./company.dto');
const { parseQuery } = require('../../shared/query/queryParser');
const { success } = require('../../shared/http/apiResponse');
const asyncHandler = require('../../shared/http/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, querySchema);
  const { items, total } = await service.listCompanies(q);
  return success(res, {
    data: dto.toPublicList(items),
    meta: service.buildListMeta(q, total),
  });
});

const getById = asyncHandler(async (req, res) => {
  const company = await service.getCompany(req.params.id);
  return success(res, { data: dto.toPublic(company) });
});

const create = asyncHandler(async (req, res) => {
  const company = await service.createCompany(req.body);
  res.setHeader('Location', `/api/v1/companies/${company.id}`);
  return success(res, { data: dto.toPublic(company), status: 201 });
});

const update = asyncHandler(async (req, res) => {
  const company = await service.updateCompany(req.params.id, req.body);
  return success(res, { data: dto.toPublic(company) });
});

const listJobsForCompany = asyncHandler(async (req, res) => {
  await service.getCompany(req.params.id); // 404 if missing
  const q = parseQuery(req.query, jobQuerySchema);
  const nested = { ...q, filters: { ...q.filters, companyId: req.params.id } };
  const { items, total } = await jobService.listJobs(nested);
  return success(res, {
    data: jobDto.toPublicList(items),
    meta: jobService.buildListMeta(nested, total),
  });
});

module.exports = { list, getById, create, update, listJobsForCompany };
