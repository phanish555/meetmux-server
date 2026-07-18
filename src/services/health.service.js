const config = require('../config/env');

function getHealthStatus() {
  return {
    status: 'ok',
    app: config.appName,
    environment: config.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

function getReadyStatus() {
  return { ready: true };
}

module.exports = { getHealthStatus, getReadyStatus };
