const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const ApiError = require('../errors/ApiError');
const config = require('../../config/env');

// In test mode we don't want to hit rate limits during automated runs.
// Turn every limiter into a no-op middleware so tests can hammer login etc.
const NOOP = (req, res, next) => next();
const isTest = config.nodeEnv === 'test';

const handler = (req, res, next) =>
  next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.'));

function make(options) {
  return isTest ? NOOP : rateLimit({ standardHeaders: true, legacyHeaders: false, handler, ...options });
}

const globalLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

// Login: keyed on IP + email so a distributed attack and a shared network
// both get properly bounded.
const loginLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${(req.body?.email || '').toLowerCase()}`,
});

const registerLimiter = make({
  windowMs: 60 * 60 * 1000,
  max: 3,
});

module.exports = { globalLimiter, loginLimiter, registerLimiter };
