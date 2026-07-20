const service = require('./interview.service');
const querySchema = require('./interview.queryschema');
const dto = require('./interview.dto');
const { parseQuery } = require('../../shared/query/queryParser');
const { success } = require('../../shared/http/apiResponse');
const asyncHandler = require('../../shared/http/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const q = parseQuery(req.query, querySchema);
  const { items, total } = await service.listInterviews(q);
  return success(res, {
    data: dto.toPublicList(items),
    meta: service.buildListMeta(q, total),
  });
});

const getById = asyncHandler(async (req, res) => {
  const iv = await service.getInterview(req.params.id);
  return success(res, { data: dto.toPublic(iv) });
});

const create = asyncHandler(async (req, res) => {
  const iv = await service.createInterview(req.body);
  res.setHeader('Location', `/api/v1/interviews/${iv.id}`);
  return success(res, { data: dto.toPublic(iv), status: 201 });
});

module.exports = { list, getById, create };
