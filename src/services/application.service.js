const { applicationRepo, studentRepo, jobRepo } = require('./repositories');
const ApiError = require('../utils/ApiError');
const {
  validateCreateApplication,
  validateStatusPatch,
} = require('../validators/application.validator');

const ALLOWED_TRANSITIONS = {
  'submitted': ['under-review', 'rejected'],
  'under-review': ['shortlisted', 'rejected'],
  'shortlisted': ['offered', 'rejected'],
  'offered': [],
  'rejected': [],
};

function applyFilters(list, query) {
  let out = list;
  if (query.studentId) out = out.filter((a) => a.studentId === query.studentId);
  if (query.jobId) out = out.filter((a) => a.jobId === query.jobId);
  if (query.status) out = out.filter((a) => a.status === query.status);
  return out;
}

function stripKey(app) {
  const { idempotencyKey, ...rest } = app;
  return rest;
}

async function listApplications(query, { offset, limit }) {
  const all = await applicationRepo.findAll();
  const filtered = applyFilters(all, query);
  return {
    items: filtered.slice(offset, offset + limit).map(stripKey),
    total: filtered.length,
  };
}

async function getApplication(id) {
  const app = await applicationRepo.findById(id);
  if (!app) {
    throw ApiError.notFound(`Application with id ${id} was not found`);
  }
  return stripKey(app);
}

async function createApplication(body, idempotencyKey) {
  const errors = validateCreateApplication(body);
  if (errors.length) {
    throw ApiError.validation('One or more fields are invalid', errors);
  }

  const student = await studentRepo.findById(body.studentId);
  if (!student) throw ApiError.badRequest(`studentId ${body.studentId} does not exist`);

  const job = await jobRepo.findById(body.jobId);
  if (!job) throw ApiError.badRequest(`jobId ${body.jobId} does not exist`);

  if (idempotencyKey) {
    const replayed = await applicationRepo.findByIdempotencyKey(idempotencyKey);
    if (replayed) return { application: stripKey(replayed), replayed: true };
  }

  const duplicate = await applicationRepo.findByStudentAndJob(body.studentId, body.jobId);
  if (duplicate) {
    throw ApiError.conflict('This student has already applied to this job');
  }

  const now = new Date().toISOString();
  const application = {
    id: `app_${Date.now()}`,
    studentId: body.studentId,
    jobId: body.jobId,
    status: 'submitted',
    appliedAt: now,
    updatedAt: now,
    idempotencyKey: idempotencyKey || null,
  };

  const created = await applicationRepo.create(application);
  return { application: stripKey(created), replayed: false };
}

async function updateStatus(id, body) {
  const errors = validateStatusPatch(body);
  if (errors.length) {
    throw ApiError.validation('One or more fields are invalid', errors);
  }

  const app = await applicationRepo.findById(id);
  if (!app) throw ApiError.notFound(`Application ${id} was not found`);

  const allowed = ALLOWED_TRANSITIONS[app.status];
  if (!allowed.includes(body.status)) {
    throw ApiError.badRequest(
      `Cannot move from ${app.status} to ${body.status}. Allowed: ${allowed.join(', ') || 'none'}`
    );
  }

  const updated = await applicationRepo.update(id, {
    status: body.status,
    updatedAt: new Date().toISOString(),
  });
  return stripKey(updated);
}

module.exports = { listApplications, getApplication, createApplication, updateStatus };
