const ApiError = require('../errors/ApiError');

const TARGETS = ['body', 'query', 'params', 'headers'];

// Zod's internal issue codes are an implementation detail. Expose our own
// stable, public vocabulary so clients can branch without depending on the
// library we happen to use today.
const ISSUE_CODES = {
  invalid_type: 'INVALID_TYPE',
  too_small: 'TOO_SMALL',
  too_big: 'TOO_BIG',
  invalid_string: 'INVALID_FORMAT',
  invalid_format: 'INVALID_FORMAT',
  invalid_enum_value: 'INVALID_OPTION',
  invalid_value: 'INVALID_OPTION',
  unrecognized_keys: 'UNKNOWN_FIELD',
  invalid_union: 'INVALID_VALUE',
  custom: 'INVALID_VALUE',
};

function normaliseHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
}

function formatIssues(error, target) {
  return error.issues.map((issue) => ({
    field: [target, ...issue.path].filter(Boolean).join('.'),
    code: ISSUE_CODES[issue.code] || 'INVALID_VALUE',
    message: issue.message,
  }));
}

function dedupe(details) {
  const seen = new Set();
  return details.filter((d) => {
    const key = `${d.field}:${d.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * validate({ body, query, params, headers })
 *
 * Runs safeParse on each provided target. Parsed output lands in
 * req.validated.<target>. body/params also overwrite req.body / req.params
 * so downstream controllers stay readable. req.query is left ALONE because
 * Express 5 makes it a getter — assignment silently fails.
 */
function validate(schemas = {}) {
  const middleware = (req, res, next) => {
    const details = [];
    req.validated = req.validated || {};

    for (const target of TARGETS) {
      const schema = schemas[target];
      if (!schema) continue;

      const input =
        target === 'headers' ? normaliseHeaders(req.headers) : req[target];
      const result = schema.safeParse(input);

      if (result.success) {
        req.validated[target] = result.data;
      } else {
        details.push(...formatIssues(result.error, target));
      }
    }

    if (details.length > 0) {
      // 400 for query/path/header issues (malformed request),
      // 422 for body issues (well-formed but semantically invalid).
      // Matches Task 3's original error semantics.
      const uniq = dedupe(details);
      const isBodyOnly = uniq.every((d) => d.field.startsWith('body'));
      return next(
        isBodyOnly
          ? ApiError.validation('Request validation failed', uniq)
          : ApiError.badRequest('Request validation failed', uniq),
      );
    }

    if (req.validated.body !== undefined) req.body = req.validated.body;
    if (req.validated.params !== undefined) req.params = req.validated.params;
    req.validatedQuery = req.validated.query;

    return next();
  };
  // Name is used by the coverage test to prove every route was gated.
  Object.defineProperty(middleware, 'name', { value: 'validate' });
  return middleware;
}

module.exports = validate;
