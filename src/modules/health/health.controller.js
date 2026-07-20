const service = require('./health.service');

function healthCheck(req, res) {
  res.status(200).json(service.getHealthStatus());
}

function readyCheck(req, res) {
  res.status(200).json(service.getReadyStatus());
}

module.exports = { healthCheck, readyCheck };
