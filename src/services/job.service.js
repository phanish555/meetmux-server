const { jobRepo, companyRepo } = require('./repositories');
const ApiError = require('../utils/ApiError');

function applyFilters(list, query) {
  let out = list;
  if (query.companyId) out = out.filter((j) => j.companyId === query.companyId);
  if (query.type) out = out.filter((j) => j.type === query.type);
  if (query.location) {
    out = out.filter((j) => j.location.toLowerCase().includes(String(query.location).toLowerCase()));
  }
  if (query.minStipend) {
    out = out.filter((j) => j.stipend !== null && j.stipend >= Number(query.minStipend));
  }
  if (query.skill) {
    const skill = String(query.skill).toLowerCase();
    out = out.filter((j) => j.skills.some((k) => k.toLowerCase() === skill));
  }
  return out;
}

async function listJobs(query, { offset, limit }) {
  const all = await jobRepo.findAll();
  const filtered = applyFilters(all, query);
  return { items: filtered.slice(offset, offset + limit), total: filtered.length };
}

async function getJob(id, { expand } = {}) {
  const job = await jobRepo.findById(id);
  if (!job) {
    throw ApiError.notFound(`Job with id ${id} was not found`);
  }

  if (expand === 'company') {
    const company = await companyRepo.findById(job.companyId);
    return { ...job, company: company || null };
  }

  return job;
}

module.exports = { listJobs, getJob };
