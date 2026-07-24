const express = require('express');
const controller = require('./application.controller');
const { requireRole } = require('../../shared/middleware/authorize');

const router = express.Router();

router.get('/applications', controller.list);
router.get('/applications/:id', controller.getById);

// A student applies on their own behalf; ADMIN can create too (for testing)
router.post('/applications', requireRole('STUDENT', 'ADMIN'), controller.create);

// Only recruiters/officers/admin may change status; students may only withdraw
router.patch('/applications/:id/status',
  requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'),
  controller.patchStatus);
router.post('/applications/:id/withdrawal',
  requireRole('STUDENT', 'ADMIN'),
  controller.withdraw);

router.get('/applications/:id/interviews', controller.listInterviewsForApplication);

module.exports = router;
