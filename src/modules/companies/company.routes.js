const express = require('express');
const controller = require('./company.controller');
const { requireRole } = require('../../shared/middleware/authorize');
const validate = require('../../shared/middleware/validate');
const schema = require('./company.schema');

const router = express.Router();

router.get('/companies', validate(schema.list), controller.list);
router.get('/companies/:id', validate(schema.getOne), controller.getById);
router.post('/companies',
  requireRole('PLACEMENT_OFFICER', 'ADMIN'),
  validate(schema.create), controller.create);
router.patch('/companies/:id',
  requireRole('PLACEMENT_OFFICER', 'ADMIN', 'RECRUITER'),
  validate(schema.update), controller.update);
router.get('/companies/:id/jobs',
  validate(schema.listJobs), controller.listJobsForCompany);

module.exports = router;
