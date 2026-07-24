const { execSync } = require('child_process');

module.exports = async function globalSetup() {
  // dotenv-cli via `npm test` already exposed DATABASE_URL from .env.test.
  // Apply any pending migrations to the test database.
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
};
