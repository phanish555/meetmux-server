const JOB_TYPES = ['internship', 'full-time'];

function validateCreateJob(body) {
  const errors = [];

  if (!body.companyId || typeof body.companyId !== 'string') {
    errors.push({ field: 'companyId', message: 'companyId is required' });
  }
  if (!body.title || typeof body.title !== 'string' || body.title.trim().length < 2) {
    errors.push({ field: 'title', message: 'title is required (min 2 chars)' });
  }
  if (!body.location || typeof body.location !== 'string') {
    errors.push({ field: 'location', message: 'location is required' });
  }
  if (!body.type || !JOB_TYPES.includes(body.type)) {
    errors.push({ field: 'type', message: `type must be one of: ${JOB_TYPES.join(', ')}` });
  }
  if (body.stipend !== undefined && body.stipend !== null) {
    const n = Number(body.stipend);
    if (Number.isNaN(n) || n < 0) {
      errors.push({ field: 'stipend', message: 'stipend must be a non-negative number or null' });
    }
  }
  if (body.skills !== undefined && !Array.isArray(body.skills)) {
    errors.push({ field: 'skills', message: 'skills must be an array' });
  }
  if (body.openings !== undefined) {
    const n = Number(body.openings);
    if (!Number.isInteger(n) || n < 1) {
      errors.push({ field: 'openings', message: 'openings must be an integer >= 1' });
    }
  }
  if (!body.deadline || Number.isNaN(new Date(body.deadline).getTime())) {
    errors.push({ field: 'deadline', message: 'deadline is required (ISO date)' });
  }
  return errors;
}

function validateUpdateJob(body) {
  const errors = [];
  const allowed = ['title', 'location', 'type', 'stipend', 'skills', 'openings', 'deadline'];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) {
    errors.push({ field: 'body', message: `unknown or immutable fields: ${unknown.join(', ')}` });
  }

  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim().length < 2)) {
    errors.push({ field: 'title', message: 'title must be at least 2 chars' });
  }
  if (body.location !== undefined && typeof body.location !== 'string') {
    errors.push({ field: 'location', message: 'location must be a string' });
  }
  if (body.type !== undefined && !JOB_TYPES.includes(body.type)) {
    errors.push({ field: 'type', message: `type must be one of: ${JOB_TYPES.join(', ')}` });
  }
  if (body.stipend !== undefined && body.stipend !== null) {
    const n = Number(body.stipend);
    if (Number.isNaN(n) || n < 0) {
      errors.push({ field: 'stipend', message: 'stipend must be a non-negative number or null' });
    }
  }
  if (body.skills !== undefined && !Array.isArray(body.skills)) {
    errors.push({ field: 'skills', message: 'skills must be an array' });
  }
  if (body.openings !== undefined) {
    const n = Number(body.openings);
    if (!Number.isInteger(n) || n < 1) {
      errors.push({ field: 'openings', message: 'openings must be an integer >= 1' });
    }
  }
  if (body.deadline !== undefined && Number.isNaN(new Date(body.deadline).getTime())) {
    errors.push({ field: 'deadline', message: 'deadline must be an ISO date' });
  }
  return errors;
}

module.exports = { validateCreateJob, validateUpdateJob, JOB_TYPES };
