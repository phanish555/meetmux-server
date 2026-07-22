const service = require('./health.service');
const asyncHandler = require('../../shared/http/asyncHandler');

function healthCheck(req, res) {
  res.status(200).json(service.getHealthStatus());
}

const readyCheck = asyncHandler(async (req, res) => {
  const data = await service.getReadyStatus();
  res.status(200).json(data);
});

module.exports = { healthCheck, readyCheck };
