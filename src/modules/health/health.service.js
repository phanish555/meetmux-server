const config = require('../../config/env');
const healthRepo = require('./health.repository');

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
  const alive = await healthRepo.pingDatabase();
  if (!alive) {
    const err = new Error('Database unreachable');
    err.status = 503;
    err.code = 'SERVICE_UNAVAILABLE';
    err.isOperational = true;
    throw err;
  }
  return { ready: true, dataSource: 'postgres', database: 'up' };
}

module.exports = { getHealthStatus, getReadyStatus };
