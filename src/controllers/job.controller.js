const jobService = require('../services/job.service');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { parsePagination, buildMeta } = require('../utils/paginate');

const listJobs = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { items, total } = await jobService.listJobs(req.query, { offset, limit });
  return success(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getJob = asyncHandler(async (req, res) => {
  const job = await jobService.getJob(req.params.id, { expand: req.query.expand });
  return success(res, { data: job });
});

module.exports = { listJobs, getJob };
