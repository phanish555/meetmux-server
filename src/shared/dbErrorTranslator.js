const ApiError = require('./errors/ApiError');

let Prisma = null;
try { Prisma = require('@prisma/client').Prisma; } catch { /* client not generated */ }

const FRIENDLY_FIELDS = {
  email: 'email address',
  'student_id_job_id': 'application for this job',
  'application_id_round': 'interview round for this application',
  idempotency_key: 'idempotency key',
  name_city: 'name and city combination',
};

function translateDbError(err) {
  if (Prisma && err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const raw = err.meta?.target;
        const key = Array.isArray(raw) ? raw.join('_') : String(raw ?? 'value');
        const label = FRIENDLY_FIELDS[key] || key;
        return ApiError.conflict(`A record with this ${label} already exists`);
      }
      case 'P2003':
        return ApiError.badRequest('Referenced record does not exist');
      case 'P2025':
        return ApiError.notFound('The requested record was not found');
      case 'P2000':
        return ApiError.validation('A value is too long for its field');
      case 'P2034':
        return new ApiError(409, 'WRITE_CONFLICT',
          'Write conflict detected. Please retry the request.');
      default:
        return null;
    }
  }

  if (Prisma && err instanceof Prisma.PrismaClientValidationError) {
    return ApiError.badRequest('Malformed database query');
  }

  if (Prisma && err instanceof Prisma.PrismaClientInitializationError) {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', 'Database is unavailable');
  }

  // Raw Postgres CHECK-constraint failures escape Prisma classification
  if (err && err.code === '23514') {
    const name = err.constraint || 'a database constraint';
    return ApiError.validation(`Value rejected by ${name}`);
  }

  return null;
}

module.exports = { translateDbError };
