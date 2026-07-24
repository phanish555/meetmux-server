const prisma = require('../../shared/prisma');

const INCLUDE = { student: { select: { id: true } } };

function toDomain(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    passwordHash: u.passwordHash,
    role: u.role,
    emailVerified: u.emailVerified,
    failedAttempts: u.failedAttempts,
    lockedUntil: u.lockedUntil,
    lastLoginAt: u.lastLoginAt,
    passwordChangedAt: u.passwordChangedAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    deletedAt: u.deletedAt,
    studentId: u.student?.id ?? null,
  };
}

module.exports = {
  findById: async (id, client = prisma) => {
    const row = await client.user.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    return toDomain(row);
  },

  findByEmail: async (email, client = prisma) => {
    const row = await client.user.findFirst({
      where: { email: String(email).toLowerCase(), deletedAt: null },
      include: INCLUDE,
    });
    return toDomain(row);
  },

  create: async (data, client = prisma) => {
    const row = await client.user.create({
      data: {
        email: String(data.email).toLowerCase(),
        passwordHash: data.passwordHash,
        role: data.role || 'STUDENT',
        passwordChangedAt: data.passwordChangedAt || new Date(),
      },
      include: INCLUDE,
    });
    return toDomain(row);
  },

  update: async (id, data, client = prisma) => {
    const row = await client.user.update({
      where: { id },
      data,
      include: INCLUDE,
    });
    return toDomain(row);
  },
};
