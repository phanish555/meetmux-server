// Socket.io handshake authentication.
// Reuses the Task 6 JWT logic — one auth system, two transports.
// A socket that doesn't pass this middleware never gets `connection`.

const tokenService = require('../../modules/auth/token.service');
const userRepo = require('../../modules/auth/user.repository');

module.exports = async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('UNAUTHENTICATED'));

    let payload;
    try {
      payload = tokenService.verifyAccessToken(token);
    } catch {
      return next(new Error('UNAUTHENTICATED'));
    }
    if (payload.type !== 'access') return next(new Error('UNAUTHENTICATED'));

    const user = await userRepo.findById(payload.sub);
    if (!user || user.deletedAt) return next(new Error('UNAUTHENTICATED'));

    // Access-token revocation via passwordChangedAt (Task 6)
    if (user.passwordChangedAt) {
      const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (payload.iat < changedAtSec) return next(new Error('UNAUTHENTICATED'));
    }

    // Attach the authenticated identity to the socket for its lifetime
    socket.data.user = { id: user.id, role: user.role, email: user.email };
    socket.data.studentId = user.studentId ?? null;
    next();
  } catch {
    next(new Error('UNAUTHENTICATED'));
  }
};
