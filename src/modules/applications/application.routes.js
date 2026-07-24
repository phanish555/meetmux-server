const express = require('express');
const controller = require('./application.controller');
const { requireRole } = require('../../shared/middleware/authorize');
const validate = require('../../shared/middleware/validate');
const schema = require('./application.schema');

const router = express.Router();

router.get('/applications', validate(schema.list), controller.list);
router.get('/applications/:id', validate(schema.getOne), controller.getById);

router.post('/applications',
  requireRole('STUDENT', 'ADMIN'),
  validate(schema.create), controller.create);

router.patch('/applications/:id/status',
  requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'),
  validate(schema.patchStatus), controller.patchStatus);

router.post('/applications/:id/withdrawal',
  requireRole('STUDENT', 'ADMIN'),
  validate(schema.withdraw), controller.withdraw);

router.get('/applications/:id/interviews',
  validate(schema.listInterviews), controller.listInterviewsForApplication);

module.exports = router;
