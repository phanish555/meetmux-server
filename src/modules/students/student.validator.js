const VALID_STATUSES = ['seeking', 'placed', 'inactive'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCreateStudent(body) {
  const errors = [];

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'name is required and must be at least 2 characters' });
  }
  if (!body.email || !EMAIL_RE.test(body.email)) {
    errors.push({ field: 'email', message: 'a valid email is required' });
  }
  if (!body.branch || typeof body.branch !== 'string') {
    errors.push({ field: 'branch', message: 'branch is required' });
  }

  const year = Number(body.graduationYear);
  if (!Number.isInteger(year) || year < 2020 || year > 2035) {
    errors.push({ field: 'graduationYear', message: 'graduationYear must be between 2020 and 2035' });
  }

  if (body.cgpa !== undefined) {
    const cgpa = Number(body.cgpa);
    if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
      errors.push({ field: 'cgpa', message: 'cgpa must be a number between 0 and 10' });
    }
  }

  if (body.skills !== undefined && !Array.isArray(body.skills)) {
    errors.push({ field: 'skills', message: 'skills must be an array of strings' });
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    errors.push({ field: 'status', message: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  return errors;
}

function validateUpdateStudent(body) {
  const errors = [];
  const allowed = ['name', 'branch', 'graduationYear', 'cgpa', 'skills', 'status'];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) {
    errors.push({ field: 'body', message: `unknown or immutable fields: ${unknown.join(', ')}` });
  }

  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 2)) {
    errors.push({ field: 'name', message: 'name must be at least 2 characters' });
  }
  if (body.branch !== undefined && typeof body.branch !== 'string') {
    errors.push({ field: 'branch', message: 'branch must be a string' });
  }
  if (body.graduationYear !== undefined) {
    const year = Number(body.graduationYear);
    if (!Number.isInteger(year) || year < 2020 || year > 2035) {
      errors.push({ field: 'graduationYear', message: 'graduationYear must be between 2020 and 2035' });
    }
  }
  if (body.cgpa !== undefined) {
    const cgpa = Number(body.cgpa);
    if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
      errors.push({ field: 'cgpa', message: 'cgpa must be a number between 0 and 10' });
    }
  }
  if (body.skills !== undefined && !Array.isArray(body.skills)) {
    errors.push({ field: 'skills', message: 'skills must be an array' });
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    errors.push({ field: 'status', message: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  return errors;
}

module.exports = { validateCreateStudent, validateUpdateStudent, VALID_STATUSES };
