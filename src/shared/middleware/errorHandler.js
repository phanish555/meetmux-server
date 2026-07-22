const config = require('../../config/env');
const ApiError = require('../errors/ApiError');

let Prisma = null;
try { Prisma = require('@prisma/client').Prisma; } catch { /* client not generated yet */ }

function notFound(req, res, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

function mapPrismaError(err) {
  if (!Prisma || !(err instanceof Prisma.PrismaClientKnownRequestError)) return err;
  if (err.code === 'P2002') {
    const fields = err.meta?.target?.join?.(', ') ?? 'field';
    return ApiError.conflict(`A record with this ${fields} already exists`);
  }
  if (err.code === 'P2025') return ApiError.notFound('The requested record was not found');
  if (err.code === 'P2003') return ApiError.badRequest('Referenced record does not exist');
  return err;
}

function errorHandler(err, req, res, next) {
  err = mapPrismaError(err);

  const status = err.status || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.isOperational ? err.message : 'Something went wrong on our side';

  if (status >= 500) console.error(err.stack);

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: err.details || [],
      ...(config.nodeEnv === 'development' && status >= 500 && { stack: err.stack }),
    },
  });
}

function malformedJson(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON', details: [] },
    });
  }
  next(err);
}

module.exports = { notFound, errorHandler, malformedJson };
