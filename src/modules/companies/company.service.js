const repo = require('./company.repository');
const ApiError = require('../../shared/errors/ApiError');
const { validateCreateCompany, validateUpdateCompany } = require('./company.validator');
const querySchema = require('./company.queryschema');
const {
  applyFilters, applySearch, applySort, applyFields, buildMeta,
} = require('../../shared/query/listQuery');

const FILTER_HANDLERS = {
  industry: (c, v) => c.industry.toLowerCase() === String(v).toLowerCase(),
  verified: (c, v) => c.verified === (String(v).toLowerCase() === 'true'),
  location: (c, v) => c.location.toLowerCase().includes(String(v).toLowerCase()),
};

async function listCompanies(q) {
  const all = await repo.findAll();
  let result = applyFilters(all, q.filters, FILTER_HANDLERS);
  result = applySearch(result, q.search, querySchema.searchable);
  result = applySort(result, q.sort);

  const total = result.length;
  const items = applyFields(result.slice(q.offset, q.offset + q.limit), q.fields);
  return { items, total };
}

async function getCompany(id) {
  const company = await repo.findById(id);
  if (!company) throw ApiError.notFound(`Company with id ${id} was not found`);
  return company;
}

async function createCompany(body) {
  const errors = validateCreateCompany(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  const existing = await repo.findByName(body.name);
  if (existing) {
    throw ApiError.conflict(`A company named ${body.name} already exists`);
  }

  const all = await repo.findAll();
  const now = new Date().toISOString();
  return repo.create({
    id: `cmp_${String(all.length + 1).padStart(3, '0')}`,
    name: body.name.trim(),
    industry: body.industry.trim(),
    location: body.location.trim(),
    employeeCount: body.employeeCount !== undefined ? Number(body.employeeCount) : 0,
    verified: body.verified === true,
    createdAt: now,
    updatedAt: now,
  });
}

async function updateCompany(id, body) {
  const errors = validateUpdateCompany(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  const company = await repo.findById(id);
  if (!company) throw ApiError.notFound(`Company with id ${id} was not found`);

  const patch = {};
  for (const k of ['name', 'industry', 'location', 'employeeCount', 'verified']) {
    if (body[k] !== undefined) patch[k] = k === 'employeeCount' ? Number(body[k]) : body[k];
  }
  return repo.update(id, patch);
}

function buildListMeta(q, total) {
  return buildMeta({ page: q.page, limit: q.limit, total, sort: q.sort, filters: q.filters });
}

module.exports = { listCompanies, getCompany, createCompany, updateCompany, buildListMeta };
