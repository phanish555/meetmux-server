const repo = require('./job.repository');
const companyRepo = require('../companies/company.repository');
const ApiError = require('../../shared/errors/ApiError');
const { validateCreateJob, validateUpdateJob } = require('./job.validator');
const querySchema = require('./job.queryschema');
const {
  applyFilters, applySearch, applySort, applyFields, buildMeta,
} = require('../../shared/query/listQuery');
const cache = require('../../shared/cache');

const CACHE_TTL_SECONDS = 60;

const FILTER_HANDLERS = {
  companyId: (j, v) => j.companyId === v,
  type: (j, v) => j.type === v,
  location: (j, v) => j.location.toLowerCase().includes(String(v).toLowerCase()),
  minStipend: (j, v) => j.stipend !== null && j.stipend >= Number(v),
  skill: (j, v) => j.skills.some((s) => s.toLowerCase() === String(v).toLowerCase()),
};

async function listJobs(q) {
  // Cache key includes everything that affects the result. Fields is
  // deliberately excluded — clients requesting subsets share the base cache.
  const key = `jobs:list:${cache.hashObject({
    filters: q.filters, sort: q.sort, page: q.page, limit: q.limit, search: q.search,
  })}`;

  const { data, cached } = await cache.wrap(key, CACHE_TTL_SECONDS, async () => {
    const all = await repo.findAll();
    let result = applyFilters(all, q.filters, FILTER_HANDLERS);
    result = applySearch(result, q.search, querySchema.searchable);
    result = applySort(result, q.sort);
    return { items: result.slice(q.offset, q.offset + q.limit), total: result.length };
  });

  return {
    items: applyFields(data.items, q.fields),
    total: data.total,
    _cache: cached ? 'hit' : 'miss',
  };
}

async function getJob(id, { expand } = {}) {
  const job = await repo.findById(id);
  if (!job) throw ApiError.notFound(`Job with id ${id} was not found`);

  const wants = Array.isArray(expand) ? expand : (expand ? String(expand).split(',') : []);
  if (wants.includes('company')) {
    job.company = await companyRepo.findById(job.companyId);
  }
  return job;
}

async function createJob(body) {
  const errors = validateCreateJob(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  // INV-1: Job.companyId must reference an existing Company
  const company = await companyRepo.findById(body.companyId);
  if (!company) {
    throw ApiError.badRequest(`companyId ${body.companyId} does not exist`);
  }

  // INV-6: Job.deadline must be in the future at creation time
  if (new Date(body.deadline) <= new Date()) {
    throw ApiError.validation('deadline must be a future date', [
      { field: 'deadline', message: 'must be in the future' },
    ]);
  }

  const now = new Date().toISOString();
  const created = await repo.create({
    id: `job_${Date.now()}`,
    companyId: body.companyId,
    title: body.title.trim(),
    location: body.location.trim(),
    type: body.type,
    stipend: body.stipend ?? null,
    skills: body.skills ?? [],
    openings: body.openings ?? 1,
    deadline: body.deadline,
    createdAt: now,
    updatedAt: now,
  });
  await invalidateJobCaches();
  return created;
}

async function updateJob(id, body) {
  const errors = validateUpdateJob(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  const job = await repo.findById(id);
  if (!job) throw ApiError.notFound(`Job with id ${id} was not found`);

  const patch = {};
  for (const k of ['title', 'location', 'type', 'stipend', 'skills', 'openings', 'deadline']) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (patch.title) patch.title = patch.title.trim();
  if (patch.location) patch.location = patch.location.trim();

  const updated = await repo.update(id, patch);
  await invalidateJobCaches(id);
  return updated;
}

// Event-based invalidation: any write to jobs makes list caches AND
// per-student recommendation caches stale.
async function invalidateJobCaches(jobId) {
  await cache.del('jobs:list:*');
  await cache.del('recs:*');
  if (jobId) await cache.del(`job:${jobId}`);
}

async function listJobsByCompany(companyId, q) {
  const company = await companyRepo.findById(companyId);
  if (!company) throw ApiError.notFound(`Company with id ${companyId} was not found`);

  const nested = { ...q, filters: { ...q.filters, companyId } };
  return listJobs(nested);
}

function buildListMeta(q, total) {
  return buildMeta({ page: q.page, limit: q.limit, total, sort: q.sort, filters: q.filters });
}

// Task 8: relational feature — jobs a student is a good match for.
// Task 9: cached with a longer TTL because it's expensive to compute.
// Invalidated by job writes (invalidateJobCaches uses del('recs:*')).
async function recommendedForStudent(studentId) {
  const key = `recs:${studentId}`;
  const { data, cached } = await cache.wrap(key, 120, async () => {
    return computeRecommendations(studentId);
  });
  // Attach hit/miss marker for observability + demo
  return Object.assign(data.slice(), { _cache: cached ? 'hit' : 'miss' });
}

async function computeRecommendations(studentId) {
  const studentRepo = require('../students/student.repository');
  const skillRepo = require('../skills/skill.repository');
  const jobRepo = require('./job.db.repository');

  const student = await studentRepo.findById(studentId);
  if (!student) throw ApiError.notFound(`Student with id ${studentId} was not found`);

  const skillNames = new Set((student.skills || []).map((s) => s.toLowerCase()));
  if (skillNames.size === 0) return [];

  const skillIds = (await skillRepo.findIdsByNames([...skillNames])).map((s) => s.id);
  const jobs = await jobRepo.findWithSkillOverlap(skillIds);

  return jobs
    .map((job) => {
      const jobSkillNames = (job.jobSkills || []).map((js) => js.skill.name.toLowerCase());
      const overlap = jobSkillNames.filter((n) => skillNames.has(n)).length;
      return {
        id: job.id,
        title: job.title,
        location: job.city,
        type: job.type === 'FULL_TIME' ? 'full-time' : 'internship',
        stipend: job.stipendPaise ? Math.round(job.stipendPaise / 100) : null,
        openings: job.openings,
        deadline: job.deadline instanceof Date ? job.deadline.toISOString().slice(0, 10) : job.deadline,
        company: job.company,
        requiredSkills: jobSkillNames,
        matchScore: overlap,
        matchTotal: jobSkillNames.length,
        applicantCount: job._count?.applications ?? 0,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

module.exports = { listJobs, getJob, createJob, updateJob, listJobsByCompany, buildListMeta, recommendedForStudent };
