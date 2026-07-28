const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { initSocket } = require('./realtime/io');
const { registerHandlers } = require('./realtime/handlers');

// Wrap Express in an explicit http.Server so Socket.io can attach to the
// SAME server — one port for HTTP + WebSocket, one load-balanced address.
const server = http.createServer(app);

(async () => {
  const io = await initSocket(server);
  registerHandlers(io);

  server.listen(config.port, () => {
    console.log(`✓ ${config.appName} running on http://localhost:${config.port}`);
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Data source: ${config.dataSource}`);
    console.log(`   Health check: http://localhost:${config.port}/api/v1/health`);
    console.log(`   API docs:     http://localhost:${config.port}/api/docs`);
    console.log(`   WebSocket:    ws://localhost:${config.port} (Socket.io)`);
  });
})();

async function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    if (config.dataSource === 'postgres') {
      try {
        const prisma = require('./shared/prisma');
        await prisma.$disconnect();
        console.log('Prisma disconnected.');
      } catch (e) {
        console.error('Error disconnecting Prisma:', e);
      }
    }
    try {
      const cache = require('./shared/cache');
      await cache.disconnect();
    } catch { /* noop */ }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
