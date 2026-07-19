const applicationService = require('../services/application.service');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { parsePagination, buildMeta } = require('../utils/paginate');

const listApplications = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { items, total } = await applicationService.listApplications(req.query, { offset, limit });
  return success(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getApplication = asyncHandler(async (req, res) => {
  const app = await applicationService.getApplication(req.params.id);
  return success(res, { data: app });
});

const createApplication = asyncHandler(async (req, res) => {
  const key = req.get('Idempotency-Key');
  const { application, replayed } = await applicationService.createApplication(req.body, key);
  if (!replayed) {
    res.setHeader('Location', `/api/v1/applications/${application.id}`);
  }
  return success(res, { data: application, status: replayed ? 200 : 201 });
});

const patchApplication = asyncHandler(async (req, res) => {
  const updated = await applicationService.updateStatus(req.params.id, req.body);
  return success(res, { data: updated });
});

module.exports = { listApplications, getApplication, createApplication, patchApplication };
