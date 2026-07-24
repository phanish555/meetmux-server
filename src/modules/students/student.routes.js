const express = require('express');
const controller = require('./student.controller');
const { requireRole } = require('../../shared/middleware/authorize');
const validate = require('../../shared/middleware/validate');
const schema = require('./student.schema');

const router = express.Router();

router.get('/students',
  requireRole('PLACEMENT_OFFICER', 'ADMIN', 'RECRUITER'),
  validate(schema.list), controller.list);

router.get('/students/:id',
  validate(schema.getOne), controller.getById);

router.post('/students',
  requireRole('ADMIN'),
  validate(schema.create), controller.create);

router.patch('/students/:id',
  validate(schema.update), controller.update);

router.get('/students/:id/applications',
  validate(schema.listApplications), controller.listApplicationsForStudent);

module.exports = router;
