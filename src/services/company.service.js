const { companyRepo } = require('./repositories');
const ApiError = require('../utils/ApiError');

function applyFilters(list, query) {
  let out = list;
  if (query.industry) {
    out = out.filter((c) => c.industry.toLowerCase() === String(query.industry).toLowerCase());
  }
  if (query.verified !== undefined) {
    const want = String(query.verified).toLowerCase() === 'true';
    out = out.filter((c) => c.verified === want);
  }
  if (query.search) {
    const term = String(query.search).toLowerCase();
    out = out.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.location.toLowerCase().includes(term) ||
        c.industry.toLowerCase().includes(term)
    );
  }
  return out;
}

async function listCompanies(query, { offset, limit }) {
  const all = await companyRepo.findAll();
  const filtered = applyFilters(all, query);
  return { items: filtered.slice(offset, offset + limit), total: filtered.length };
}

async function getCompany(id) {
  const company = await companyRepo.findById(id);
  if (!company) {
    throw ApiError.notFound(`Company with id ${id} was not found`);
  }
  return company;
}

module.exports = { listCompanies, getCompany };
