function validateCreateCompany(body) {
  const errors = [];

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'name is required (min 2 chars)' });
  }
  if (!body.industry || typeof body.industry !== 'string') {
    errors.push({ field: 'industry', message: 'industry is required' });
  }
  if (!body.location || typeof body.location !== 'string') {
    errors.push({ field: 'location', message: 'location is required' });
  }
  if (body.employeeCount !== undefined) {
    const n = Number(body.employeeCount);
    if (!Number.isInteger(n) || n < 0) {
      errors.push({ field: 'employeeCount', message: 'employeeCount must be a non-negative integer' });
    }
  }
  if (body.verified !== undefined && typeof body.verified !== 'boolean') {
    errors.push({ field: 'verified', message: 'verified must be a boolean' });
  }
  return errors;
}

function validateUpdateCompany(body) {
  const errors = [];
  const allowed = ['name', 'industry', 'location', 'employeeCount', 'verified'];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) {
    errors.push({ field: 'body', message: `unknown or immutable fields: ${unknown.join(', ')}` });
  }

  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 2)) {
    errors.push({ field: 'name', message: 'name must be at least 2 chars' });
  }
  if (body.industry !== undefined && typeof body.industry !== 'string') {
    errors.push({ field: 'industry', message: 'industry must be a string' });
  }
  if (body.location !== undefined && typeof body.location !== 'string') {
    errors.push({ field: 'location', message: 'location must be a string' });
  }
  if (body.employeeCount !== undefined) {
    const n = Number(body.employeeCount);
    if (!Number.isInteger(n) || n < 0) {
      errors.push({ field: 'employeeCount', message: 'employeeCount must be a non-negative integer' });
    }
  }
  if (body.verified !== undefined && typeof body.verified !== 'boolean') {
    errors.push({ field: 'verified', message: 'verified must be a boolean' });
  }
  return errors;
}

module.exports = { validateCreateCompany, validateUpdateCompany };
