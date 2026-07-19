const config = require('../config/env');
const ApiError = require('../utils/ApiError');

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

module.exports = { notFound, errorHandler };
