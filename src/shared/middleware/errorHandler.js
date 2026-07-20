const config = require('../../config/env');
const ApiError = require('../errors/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
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
