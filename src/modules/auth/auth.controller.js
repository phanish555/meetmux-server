const service = require('./auth.service');
const { success } = require('../../shared/http/apiResponse');
const asyncHandler = require('../../shared/http/asyncHandler');

function contextFrom(req) {
  return {
    userAgent: req.get('user-agent'),
    ip: req.ip,
  };
}

const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await service.register(req.body, contextFrom(req));
  return success(res, {
    data: { user, accessToken, refreshToken },
    status: 201,
  });
});

const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await service.login(req.body, contextFrom(req));
  return success(res, { data: { user, accessToken, refreshToken } });
});

const refresh = asyncHandler(async (req, res) => {
  const raw = req.body?.refreshToken || req.cookies?.refreshToken;
  const { accessToken, refreshToken } = await service.refresh(raw, contextFrom(req));
  return success(res, { data: { accessToken, refreshToken } });
});

const logout = asyncHandler(async (req, res) => {
  const raw = req.body?.refreshToken || req.cookies?.refreshToken;
  await service.logout(raw);
  return success(res, { data: { ok: true } });
});

const logoutEverywhere = asyncHandler(async (req, res) => {
  await service.logoutEverywhere(req.user.id);
  return success(res, { data: { ok: true } });
});

const me = asyncHandler(async (req, res) => {
  return success(res, {
    data: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      studentId: req.user.studentId,
    },
  });
});

module.exports = { register, login, refresh, logout, logoutEverywhere, me };
