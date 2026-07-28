// Socket.io init. Attaches to the SAME HTTP server as Express — one port
// for HTTP + WebSocket, which matters for deployment and load balancing.
//
// If REDIS_URL is set, wire the Redis adapter so events reach sockets on
// any instance. If not, run single-instance (which is fine for dev).

const { Server } = require('socket.io');
const config = require('../config/env');

let io = null;

async function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`Origin ${origin} not permitted by Socket.io CORS`));
      },
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    // Buffer missed events for reconnects within a short window
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false, // still re-run authentication
    },
  });

  // Optional: wire the Redis adapter so this instance shares rooms
  // with every other instance. Required at scale.
  if (config.redis.url) {
    try {
      const Redis = require('ioredis');
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pub = new Redis(config.redis.url, { enableOfflineQueue: false });
      const sub = pub.duplicate();
      // Ready-check without failing the boot if Redis isn't up
      pub.on('error', () => {});
      sub.on('error', () => {});
      io.adapter(createAdapter(pub, sub));
      console.log(JSON.stringify({
        level: 'info', component: 'realtime',
        message: 'Redis adapter wired — cross-instance delivery enabled',
      }));
    } catch (e) {
      console.warn(JSON.stringify({
        level: 'warn', component: 'realtime',
        message: 'Redis adapter unavailable — running single-instance only',
        error: e.message,
      }));
    }
  }

  return io;
}

function getIo() {
  return io; // may be null in test contexts where realtime isn't booted
}

module.exports = { initSocket, getIo };
