const express = require('express');
const controller = require('./job.controller');
const { requireRole } = require('../../shared/middleware/authorize');

const router = express.Router();

router.get('/jobs', controller.list);
router.get('/jobs/:id', controller.getById);
router.post('/jobs', requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'), controller.create);
router.patch('/jobs/:id', requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'), controller.update);
router.get('/jobs/:id/applications',
  requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'),
  controller.listApplicationsForJob);

module.exports = router;
