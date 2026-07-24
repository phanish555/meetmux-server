const express = require('express');
const controller = require('./job.controller');
const { requireRole } = require('../../shared/middleware/authorize');
const validate = require('../../shared/middleware/validate');
const schema = require('./job.schema');

const router = express.Router();

router.get('/jobs', validate(schema.list), controller.list);
router.get('/jobs/:id', validate(schema.getOne), controller.getById);
router.post('/jobs',
  requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'),
  validate(schema.create), controller.create);
router.patch('/jobs/:id',
  requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'),
  validate(schema.update), controller.update);
router.get('/jobs/:id/applications',
  requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'),
  validate(schema.listApplications), controller.listApplicationsForJob);

module.exports = router;
