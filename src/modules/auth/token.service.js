const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config/env');
const refreshRepo = require('./refreshToken.repository');

function ttlToMs(spec) {
  const m = String(spec).match(/^(\d+)(s|m|h|d)$/);
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
  return n * unit;
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      type: 'access',
    },
    config.auth.accessSecret,
    {
      expiresIn: config.auth.accessTtl,
      issuer: config.auth.issuer,
      audience: config.auth.audience,
      algorithm: 'HS256',
    }
  );
}

function verifyAccessToken(token) {
  // Pinning the algorithm defeats the `alg: none` attack — never let
  // the token tell you how to verify itself.
  return jwt.verify(token, config.auth.accessSecret, {
    issuer: config.auth.issuer,
    audience: config.auth.audience,
    algorithms: ['HS256'],
  });
}

// Refresh tokens are opaque random bytes, not JWTs.
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueRefreshToken(userId, { family, userAgent, ip, client } = {}) {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + ttlToMs(config.auth.refreshTtl));

  await refreshRepo.create({
    userId,
    tokenHash: hashToken(token),
    family: family || crypto.randomUUID(),
    expiresAt,
    userAgent: userAgent ? String(userAgent).slice(0, 300) : null,
    ipAddress: ip || null,
  }, client);

  return token; // plaintext returned once, never stored
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  issueRefreshToken,
  ttlToMs,
};
