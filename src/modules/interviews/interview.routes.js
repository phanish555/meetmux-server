const express = require('express');
const controller = require('./interview.controller');
const { requireRole } = require('../../shared/middleware/authorize');

const router = express.Router();

router.get('/interviews',
  requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'),
  controller.list);
router.post('/interviews',
  requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'),
  controller.create);
router.get('/interviews/:id', controller.getById);

module.exports = router;
