// Cache-aside wrapper around ioredis.
//
// The critical property: if Redis is unavailable or absent, every call
// silently no-ops (or returns null). A cache is an optimisation, NEVER
// a dependency — a Redis outage means "slower", not "down".
//
// If REDIS_URL is not set in env, the client is never even constructed —
// the app runs uncached and that is a valid production configuration
// for single-instance deployments.

const config = require('../config/env');

let redis = null;
let redisReady = false;

if (config.redis.url) {
  try {
    const Redis = require('ioredis');
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false, // fail fast when Redis is unreachable
      lazyConnect: false,
    });
    redis.on('ready', () => { redisReady = true; });
    redis.on('error', (e) => {
      redisReady = false;
      if (config.nodeEnv !== 'test') {
        console.warn(JSON.stringify({
          level: 'warn', component: 'cache', message: 'redis error, degrading to uncached',
          error: e.message,
        }));
      }
    });
    redis.on('end', () => { redisReady = false; });
  } catch {
    // ioredis missing or failed to init — treat like Redis absent
    redis = null;
  }
}

function isEnabled() {
  return redis !== null && redisReady;
}

async function get(key) {
  if (!isEnabled()) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function set(key, value, ttlSeconds = config.redis.defaultTtl) {
  if (!isEnabled()) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch { /* best effort */ }
}

async function del(pattern) {
  if (!isEnabled()) return;
  try {
    if (pattern.includes('*')) {
      const keys = await redis.keys(pattern);
      if (keys.length) await redis.del(...keys);
    } else {
      await redis.del(pattern);
    }
  } catch { /* best effort */ }
}

// Small helper that reads through: returns cached value if present,
// otherwise runs the loader, stores it, and returns it.
async function wrap(key, ttlSeconds, loader) {
  const hit = await get(key);
  if (hit !== null) return { data: hit, cached: true };
  const fresh = await loader();
  await set(key, fresh, ttlSeconds);
  return { data: fresh, cached: false };
}

// Deterministic hash of an object — used for query-based cache keys
function hashObject(obj) {
  const crypto = require('crypto');
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(obj, Object.keys(obj || {}).sort()))
    .digest('hex')
    .slice(0, 12);
}

async function disconnect() {
  if (redis) await redis.quit().catch(() => {});
}

module.exports = { get, set, del, wrap, isEnabled, hashObject, disconnect, _client: () => redis };
