const healthService = require('../services/health.service');

function healthCheck(req, res) {
  const data = healthService.getHealthStatus();
  res.status(200).json(data);
}

function readyCheck(req, res) {
  const data = healthService.getReadyStatus();
  res.status(200).json(data);
}

module.exports = { healthCheck, readyCheck };
