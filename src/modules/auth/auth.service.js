const userRepo = require('./user.repository');
const studentRepo = require('../students/student.repository');
const refreshRepo = require('./refreshToken.repository');
const tokenService = require('./token.service');
const password = require('./password.service');
const { validateRegister, validateLogin } = require('./auth.validator');
const { toUserDTO } = require('./auth.dto');
const ApiError = require('../../shared/errors/ApiError');
const { runInTransaction } = require('../../shared/transactions');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

async function register(body, context = {}) {
  const errors = validateRegister(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  const email = String(body.email).toLowerCase().trim();

  const existing = await userRepo.findByEmail(email);
  if (existing) {
    // Trade-off: clearer error costs some user-enumeration privacy.
    // Documented in ADR-0017.
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await password.hashPassword(body.password);

  // User + Student profile created atomically — Task 5's transaction pattern.
  const user = await runInTransaction(async (tx) => {
    const created = await userRepo.create({
      email,
      passwordHash,
      role: 'STUDENT',
      passwordChangedAt: new Date(),
    }, tx);

    const student = await studentRepo.create({
      userId: created.id,
      name: body.name.trim(),
      email,
      branch: body.branch.trim(),
      graduationYear: Number(body.graduationYear),
      cgpa: body.cgpa !== undefined ? Number(body.cgpa) : null,
      skills: body.skills || [],
      status: 'seeking',
    }, tx);

    return { ...created, studentId: student.id };
  });

  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user.id, context);

  return { user: toUserDTO(user), accessToken, refreshToken };
}

async function login(body, context = {}) {
  const errors = validateLogin(body);
  if (errors.length) throw ApiError.validation('One or more fields are invalid', errors);

  const email = String(body.email).toLowerCase().trim();
  const user = await userRepo.findByEmail(email);

  // Timing-safe: even a missing user pays the cost of a hash, so
  // "no such user" and "wrong password" take the same time.
  if (!user) {
    await password.hashPassword('dummy-to-equalise-timing');
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const seconds = Math.ceil((user.lockedUntil - Date.now()) / 1000);
    throw new ApiError(423, 'ACCOUNT_LOCKED',
      `Account is temporarily locked. Try again in ${seconds} seconds.`);
  }

  const valid = await password.verifyPassword(user.passwordHash, body.password);
  if (!valid) {
    await recordFailedAttempt(user);
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Success: reset counters, stamp last login
  await userRepo.update(user.id, {
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
  });

  // Opportunistic upgrade if we've raised the work factor since signup
  if (password.needsRehash(user.passwordHash)) {
    await userRepo.update(user.id, { passwordHash: await password.hashPassword(body.password) });
  }

  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user.id, context);

  return { user: toUserDTO(user), accessToken, refreshToken };
}

async function recordFailedAttempt(user) {
  const attempts = user.failedAttempts + 1;
  const shouldLock = attempts >= MAX_ATTEMPTS;
  await userRepo.update(user.id, {
    failedAttempts: attempts,
    lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
  });
}

async function refresh(rawToken, context = {}) {
  if (!rawToken) throw ApiError.unauthorized('Refresh token required');

  const tokenHash = tokenService.hashToken(rawToken);
  const stored = await refreshRepo.findByHash(tokenHash);
  if (!stored) throw ApiError.unauthorized('Invalid refresh token');

  // Reuse detection: a revoked token being presented means either a legit
  // client replayed an old one, or an attacker is using a stolen one.
  // We can't tell which, so we assume theft and kill the whole family.
  if (stored.revokedAt) {
    await refreshRepo.revokeFamily(stored.family);
    throw ApiError.unauthorized('Refresh token reuse detected. All sessions revoked.');
  }

  if (stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token expired');
  }

  const user = await userRepo.findById(stored.userId);
  if (!user || user.deletedAt) throw ApiError.unauthorized('Account is no longer active');

  // Rotate: new token in the same family, old one revoked, replacement recorded
  const newRefresh = await tokenService.issueRefreshToken(user.id, {
    ...context,
    family: stored.family,
  });
  await refreshRepo.revoke(stored.id, { replacedBy: tokenService.hashToken(newRefresh) });

  return {
    accessToken: tokenService.signAccessToken(user),
    refreshToken: newRefresh,
  };
}

async function logout(rawToken) {
  if (!rawToken) return;
  const stored = await refreshRepo.findByHash(tokenService.hashToken(rawToken));
  if (stored && !stored.revokedAt) await refreshRepo.revoke(stored.id);
}

async function logoutEverywhere(userId) {
  await refreshRepo.revokeAllForUser(userId);
  // passwordChangedAt bump invalidates every outstanding access token
  await userRepo.update(userId, { passwordChangedAt: new Date() });
}

module.exports = { register, login, refresh, logout, logoutEverywhere };
