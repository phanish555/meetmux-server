module.exports = async function globalTeardown() {
  // Prisma clients get disconnected inside each test file via afterAll.
};
