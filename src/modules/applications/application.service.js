const repo = require('./application.repository');
const studentRepo = require('../students/student.repository');
const jobRepo = require('../jobs/job.repository');
const ApiError = require('../../shared/errors/ApiError');
const {
  validateCreateApplication,
  validateStatusPatch,
} = require('./application.validator');
const querySchema = require('./application.queryschema');
const {
  applyFilters, applySort, applyFields, buildMeta,
} = require('../../shared/query/listQuery');

// INV-4: Application.status moves only along the defined transition graph
const ALLOWED_TRANSITIONS = {
  'submitted': ['under-review', 'rejected'],
  'under-review': ['shortlisted', 'rejected'],
  'shortlisted': ['offered', 'rejected'],
  'offered': [],
  'rejected': [],
  'withdrawn': [],
};

const FILTER_HANDLERS = {
  studentId: (a, v) => a.studentId === v,
  jobId: (a, v) => a.jobId === v,
  status: (a, v) => a.status === v,
};

// Scope filters based on caller role. Applied BEFORE the query runs — the
// service is the single place that decides "which rows may this actor see".
// Returning 404 (not 403) for out-of-scope records is deliberate: we don't
// confirm the existence of resources the caller isn't allowed to see.
function scopeFilters(filters, actor) {
  if (!actor) return filters;
  if (actor.role === 'STUDENT') {
    // A student sees only their own applications — hard-forced, ignores
    // any studentId the caller supplied.
    return { ...filters, studentId: actor.studentId || '__no_student__' };
  }
  return filters; // ADMIN/OFFICER/RECRUITER see all (further scoping later)
}

async function listApplications(q, actor) {
  const all = await repo.findAll();
  const scoped = { ...q, filters: scopeFilters(q.filters, actor) };
  let result = applyFilters(all, scoped.filters, FILTER_HANDLERS);
  result = applySort(result, q.sort);

  const total = result.length;
  const items = applyFields(result.slice(q.offset, q.offset + q.limit), q.fields);
  return { items, total };
}

async function getApplication(id, actor) {
  const app = await repo.findById(id);
  if (!app) throw ApiError.notFound(`Application with id ${id} was not found`);

  if (actor && actor.role === 'STUDENT' && app.studentId !== actor.studentId) {
    // 404 — not 403 — so we don't confirm the record exists
    throw ApiError.notFound(`Application with id ${id} was not found`);
  }
  return app;
}

async function createApplication(body, idempotencyKey, actor) {
  // Students can only apply on their own behalf; the id in the body is ignored.
  if (actor && actor.role === 'STUDENT') {
    if (!actor.studentId) throw ApiError.forbidden('This account has no student profile');
    body = { ...body, studentId: actor.studentId };
  }

  const errors = validateCreateApplication(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  // INV-2: referenced student and job must exist
  const student = await studentRepo.findById(body.studentId);
  if (!student) throw ApiError.badRequest(`studentId ${body.studentId} does not exist`);

  const job = await jobRepo.findById(body.jobId);
  if (!job) throw ApiError.badRequest(`jobId ${body.jobId} does not exist`);

  if (idempotencyKey) {
    const replayed = await repo.findByIdempotencyKey(idempotencyKey);
    if (replayed) return { application: replayed, replayed: true };
  }

  // INV-3: (studentId, jobId) unique
  const duplicate = await repo.findByStudentAndJob(body.studentId, body.jobId);
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
    withdrawnAt: null,
    idempotencyKey: idempotencyKey || null,
  };

  const created = await repo.create(application);
  return { application: created, replayed: false };
}

async function updateStatus(id, body) {
  const errors = validateStatusPatch(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  const app = await repo.findById(id);
  if (!app) throw ApiError.notFound(`Application ${id} was not found`);

  const allowed = ALLOWED_TRANSITIONS[app.status];
  if (!allowed.includes(body.status)) {
    throw ApiError.invalidTransition(
      `Cannot move from ${app.status} to ${body.status}. Allowed: ${allowed.join(', ') || 'none'}`
    );
  }

  return repo.update(id, { status: body.status, updatedAt: new Date().toISOString() });
}

async function withdrawApplication(id, actor) {
  const app = await repo.findById(id);
  if (!app) throw ApiError.notFound(`Application ${id} was not found`);

  if (actor && actor.role === 'STUDENT' && app.studentId !== actor.studentId) {
    throw ApiError.notFound(`Application ${id} was not found`);
  }

  if (app.status === 'withdrawn') {
    throw ApiError.conflict(`Application ${id} is already withdrawn`);
  }
  if (['offered', 'rejected'].includes(app.status)) {
    throw ApiError.invalidTransition(`Cannot withdraw an application in status '${app.status}'`);
  }

  const now = new Date().toISOString();
  return repo.update(id, { status: 'withdrawn', withdrawnAt: now, updatedAt: now });
}

function buildListMeta(q, total) {
  return buildMeta({ page: q.page, limit: q.limit, total, sort: q.sort, filters: q.filters });
}

// Multi-table transactional operation used by the accept-offer flow.
// Everything commits or nothing does: accept this app, withdraw the student's
// other live apps, mark the student PLACED, decrement the job's openings.
// Kept as a service method (not a route yet) — demonstrable via the test suite.
async function acceptOffer(applicationId) {
  const config = require('../../config/env');
  if (config.dataSource !== 'postgres') {
    throw ApiError.badRequest('acceptOffer requires DATA_SOURCE=postgres');
  }
  const { runInTransaction } = require('../../shared/transactions');

  return runInTransaction(async (tx) => {
    const current = await repo.findById(applicationId, tx);
    if (!current) throw ApiError.notFound(`Application ${applicationId} was not found`);
    if (current.status !== 'offered') {
      throw ApiError.invalidTransition(
        `Cannot accept an application in status ${current.status}`
      );
    }

    // 2. Withdraw every other live application from this student
    const others = (await repo.findLiveByStudent(current.studentId, tx))
      .filter((a) => a.id !== applicationId);

    for (const other of others) {
      await repo.update(other.id, {
        status: 'withdrawn',
        withdrawnAt: new Date().toISOString(),
      }, tx);
    }

    // 3. Mark the student PLACED
    await studentRepo.update(current.studentId, { status: 'placed' }, tx);

    // 4. Atomically decrement remaining openings on the accepted job.
    //    The DB CHECK (openings > 0) makes over-allocation impossible.
    await jobRepo.decrementOpenings(current.jobId, tx);

    return { accepted: applicationId, withdrawnCount: others.length };
  });
}

module.exports = {
  listApplications,
  getApplication,
  createApplication,
  updateStatus,
  withdrawApplication,
  acceptOffer,
  buildListMeta,
  ALLOWED_TRANSITIONS,
};
