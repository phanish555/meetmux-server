const ApiError = require('../errors/ApiError');

// Coarse-grained role check
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowed.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action requires one of: ${allowed.join(', ')}`));
    }
    next();
  };
}

// Fine-grained permission map
const PERMISSIONS = {
  STUDENT: [
    'profile:read:own', 'profile:write:own',
    'job:read', 'company:read',
    'application:create', 'application:read:own',
  ],
  RECRUITER: [
    'job:read', 'job:write',
    'application:read', 'application:update',
  ],
  PLACEMENT_OFFICER: [
    'student:read', 'company:read', 'job:read',
    'application:read', 'application:update',
    'report:generate',
  ],
  ADMIN: ['*'],
};

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const granted = PERMISSIONS[req.user.role] || [];
    if (granted.includes('*') || granted.includes(permission)) return next();
    next(ApiError.forbidden(`Missing permission: ${permission}`));
  };
}

module.exports = { requireRole, requirePermission, PERMISSIONS };
