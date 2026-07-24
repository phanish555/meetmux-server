const prisma = require('../../shared/prisma');

async function pingDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

module.exports = { pingDatabase };
