const config = require('../../config/env');

function getHealthStatus() {
  return {
    status: 'ok',
    app: config.appName,
    environment: config.nodeEnv,
    dataSource: config.dataSource,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

async function getReadyStatus() {
  if (config.dataSource !== 'postgres') {
    return { ready: true, dataSource: config.dataSource };
  }
  const prisma = require('../../shared/prisma');
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ready: true, dataSource: 'postgres', database: 'up' };
  } catch (err) {
    const notReady = new Error('Database unreachable');
    notReady.status = 503;
    notReady.code = 'SERVICE_UNAVAILABLE';
    notReady.isOperational = true;
    throw notReady;
  }
}

module.exports = { getHealthStatus, getReadyStatus };
