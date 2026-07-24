const prisma = require('./prisma');

// Thin wrapper so services can compose transactions across repositories
// without importing prisma directly. Enforces the "repositories are the
// only files that touch prisma" boundary (npm run check:prisma-boundary).
function runInTransaction(fn, options = { timeout: 10000, isolationLevel: 'ReadCommitted' }) {
  return prisma.$transaction(fn, options);
}

module.exports = { runInTransaction };
