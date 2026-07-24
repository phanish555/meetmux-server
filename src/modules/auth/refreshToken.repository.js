const prisma = require('../../shared/prisma');

module.exports = {
  create: async (data, client = prisma) => {
    return client.refreshToken.create({ data });
  },

  findByHash: async (tokenHash, client = prisma) => {
    return client.refreshToken.findUnique({ where: { tokenHash } });
  },

  revoke: async (id, { replacedBy } = {}, client = prisma) => {
    return client.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedBy: replacedBy || null },
    });
  },

  revokeFamily: async (family, client = prisma) => {
    return client.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllForUser: async (userId, client = prisma) => {
    return client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
