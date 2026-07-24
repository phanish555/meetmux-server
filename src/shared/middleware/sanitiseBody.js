// Kills prototype-pollution keys (__proto__, constructor, prototype) before
// any downstream code sees them. Also caps recursion depth as a cheap DoS
// defence — deeply nested JSON is otherwise a one-request outage.

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 20;

function stripDangerousKeys(value, depth = 0) {
  if (depth > MAX_DEPTH) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripDangerousKeys(v, depth + 1));

  const clean = Object.create(null);
  for (const [key, v] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) continue;
    clean[key] = stripDangerousKeys(v, depth + 1);
  }
  return clean;
}

module.exports = function sanitiseBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = stripDangerousKeys(req.body);
  }
  next();
};
