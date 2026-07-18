const express = require('express');
const { healthCheck, readyCheck } = require('../controllers/health.controller');

const router = express.Router();

router.get('/health', healthCheck);
router.get('/ready', readyCheck);

module.exports = router;
