class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message, details = []) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static notFound(message) {
    return new ApiError(404, 'RESOURCE_NOT_FOUND', message);
  }

  static conflict(message) {
    return new ApiError(409, 'RESOURCE_CONFLICT', message);
  }

  static validation(message, details = []) {
    return new ApiError(422, 'VALIDATION_FAILED', message, details);
  }

  static invalidTransition(message) {
    return new ApiError(409, 'INVALID_STATE_TRANSITION', message);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Not permitted') {
    return new ApiError(403, 'FORBIDDEN', message);
  }
}

module.exports = ApiError;
