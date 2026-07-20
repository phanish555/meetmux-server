const ApiError = require('../errors/ApiError');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const RESERVED = new Set(['page', 'limit', 'sort', 'fields', 'expand', 'search']);

function parseQuery(query, schema) {
  const errors = [];

  const page = Number.parseInt(query.page ?? '1', 10);
  const limit = Number.parseInt(query.limit ?? String(DEFAULT_LIMIT), 10);

  if (!Number.isInteger(page) || page < 1) {
    errors.push({ field: 'page', message: 'page must be an integer >= 1' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    errors.push({ field: 'limit', message: `limit must be an integer between 1 and ${MAX_LIMIT}` });
  }

  const sort = [];
  if (query.sort) {
    for (const raw of String(query.sort).split(',')) {
      const desc = raw.startsWith('-');
      const field = desc ? raw.slice(1) : raw;
      if (!schema.sortable.includes(field)) {
        errors.push({
          field: 'sort',
          message: `cannot sort by '${field}'. Sortable: ${schema.sortable.join(', ')}`,
        });
        continue;
      }
      sort.push({ field, direction: desc ? 'desc' : 'asc' });
    }
  }
  if (sort.length === 0) sort.push({ field: schema.defaultSort, direction: 'desc' });

  const filters = {};
  for (const [key, value] of Object.entries(query)) {
    if (RESERVED.has(key)) continue;
    if (!schema.filterable.includes(key)) {
      errors.push({
        field: key,
        message: `unknown filter '${key}'. Allowed: ${schema.filterable.join(', ')}`,
      });
      continue;
    }
    filters[key] = value;
  }

  let fields = null;
  if (query.fields) {
    fields = String(query.fields).split(',').map((f) => f.trim());
    const unknown = fields.filter((f) => !schema.selectable.includes(f));
    if (unknown.length) {
      errors.push({ field: 'fields', message: `unknown fields: ${unknown.join(', ')}` });
    }
  }

  let expand = [];
  if (query.expand) {
    expand = String(query.expand).split(',').map((e) => e.trim());
    const unknown = expand.filter((e) => !(schema.expandable || []).includes(e));
    if (unknown.length) {
      errors.push({ field: 'expand', message: `cannot expand: ${unknown.join(', ')}` });
    }
  }

  if (errors.length) {
    throw ApiError.badRequest('Invalid query parameters', errors);
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    sort,
    filters,
    fields,
    expand,
    search: query.search ? String(query.search).trim() : null,
  };
}

module.exports = { parseQuery, DEFAULT_LIMIT, MAX_LIMIT };
