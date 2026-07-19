const ApiError = require('./ApiError');

function parsePagination(query) {
  const page = Number.parseInt(query.page ?? '1', 10);
  const limit = Number.parseInt(query.limit ?? '20', 10);

  if (!Number.isInteger(page) || page < 1) {
    throw ApiError.badRequest('page must be a positive integer');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw ApiError.badRequest('limit must be an integer between 1 and 100');
  }

  return { page, limit, offset: (page - 1) * limit };
}

function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

module.exports = { parsePagination, buildMeta };
