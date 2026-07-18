const app = require('./app');
const config = require('./config/env');

const server = app.listen(config.port, () => {
  console.log(`✓ ${config.appName} running on http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Health check: http://localhost:${config.port}/api/v1/health`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => process.exit(0));
});
