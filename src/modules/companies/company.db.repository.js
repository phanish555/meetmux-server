const prisma = require('../../shared/prisma');

const NOT_DELETED = { deletedAt: null };

function toDomain(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    industry: c.industry,
    location: c.city,
    employeeCount: c.employeeCount,
    verified: c.verified,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

module.exports = {
  findAll: async () => {
    const rows = await prisma.company.findMany({
      where: NOT_DELETED,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  },

  findById: async (id) => {
    const row = await prisma.company.findFirst({ where: { id, ...NOT_DELETED } });
    return toDomain(row);
  },

  findByName: async (name) => {
    const row = await prisma.company.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...NOT_DELETED },
    });
    return toDomain(row);
  },

  create: async (company) => {
    const row = await prisma.company.create({
      data: {
        name: company.name,
        industry: company.industry,
        city: company.location,
        employeeCount: company.employeeCount || null,
        verified: company.verified === true,
      },
    });
    return toDomain(row);
  },

  update: async (id, patch) => {
    const data = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.industry !== undefined) data.industry = patch.industry;
    if (patch.location !== undefined) data.city = patch.location;
    if (patch.employeeCount !== undefined) data.employeeCount = patch.employeeCount;
    if (patch.verified !== undefined) data.verified = patch.verified;
    const row = await prisma.company.update({ where: { id }, data });
    return toDomain(row);
  },

  reset: async () => {},
};
