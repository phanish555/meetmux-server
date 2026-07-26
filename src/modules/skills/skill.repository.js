const prisma = require('../../shared/prisma');

module.exports = {
  findIdsByNames: async (names, client = prisma) => {
    if (!Array.isArray(names) || names.length === 0) return [];
    const rows = await client.skill.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true },
    });
    return rows;
  },
};
