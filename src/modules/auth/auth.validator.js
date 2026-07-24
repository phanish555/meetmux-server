const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Small blocklist — real deployment would use a larger list (e.g. haveibeenpwned)
const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyuiop', 'letmein12345', 'welcome12345', 'iloveyou1234', 'admin1234567',
  'passw0rd1234', 'password1234',
]);

function validateRegister(body) {
  const errors = [];
  if (!body.email || !EMAIL_RE.test(body.email)) {
    errors.push({ field: 'email', message: 'a valid email is required' });
  }
  if (!body.password || typeof body.password !== 'string') {
    errors.push({ field: 'password', message: 'password is required' });
  } else {
    if (body.password.length < 12) {
      errors.push({ field: 'password', message: 'password must be at least 12 characters' });
    }
    if (body.password.length > 128) {
      errors.push({ field: 'password', message: 'password must be at most 128 characters' });
    }
    if (COMMON.has(String(body.password).toLowerCase())) {
      errors.push({ field: 'password', message: 'this password is too common — please choose another' });
    }
  }
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'name is required (min 2 chars)' });
  }
  if (!body.branch || typeof body.branch !== 'string') {
    errors.push({ field: 'branch', message: 'branch is required' });
  }
  const year = Number(body.graduationYear);
  if (!Number.isInteger(year) || year < 2020 || year > 2035) {
    errors.push({ field: 'graduationYear', message: 'graduationYear must be between 2020 and 2035' });
  }
  return errors;
}

function validateLogin(body) {
  const errors = [];
  if (!body.email || typeof body.email !== 'string') {
    errors.push({ field: 'email', message: 'email is required' });
  }
  if (!body.password || typeof body.password !== 'string') {
    errors.push({ field: 'password', message: 'password is required' });
  }
  return errors;
}

module.exports = { validateRegister, validateLogin };
