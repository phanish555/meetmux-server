const tokenService = require('../../modules/auth/token.service');
const userRepo = require('../../modules/auth/user.repository');
const ApiError = require('../errors/ApiError');
const asyncHandler = require('../http/asyncHandler');

module.exports = asyncHandler(async (req, res, next) => {
  const header = req.get('Authorization');

  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  const token = header.slice(7).trim();
  let payload;

  try {
    payload = tokenService.verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token has expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }

  if (payload.type !== 'access') {
    throw ApiError.unauthorized('Wrong token type');
  }

  const user = await userRepo.findById(payload.sub);
  if (!user || user.deletedAt) {
    throw ApiError.unauthorized('Account is no longer active');
  }

  // Access tokens issued before the last password change are dead.
  // Compare in seconds — `iat` is a whole second, `passwordChangedAt` has ms.
  if (user.passwordChangedAt) {
    const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (payload.iat < changedAtSec) {
      throw new ApiError(401, 'TOKEN_REVOKED', 'Token was invalidated. Please log in again.');
    }
  }

  req.user = {
    id: user.id,
    role: user.role,
    email: user.email,
    studentId: user.studentId ?? null,
  };
  next();
});
