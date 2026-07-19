const companyService = require('../services/company.service');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { parsePagination, buildMeta } = require('../utils/paginate');

const listCompanies = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { items, total } = await companyService.listCompanies(req.query, { offset, limit });
  return success(res, { data: items, meta: buildMeta({ page, limit, total }) });
});

const getCompany = asyncHandler(async (req, res) => {
  const company = await companyService.getCompany(req.params.id);
  return success(res, { data: company });
});

module.exports = { listCompanies, getCompany };
