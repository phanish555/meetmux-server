const express = require('express');
const controller = require('./interview.controller');
const { requireRole } = require('../../shared/middleware/authorize');
const validate = require('../../shared/middleware/validate');
const schema = require('./interview.schema');

const router = express.Router();

router.get('/interviews',
  requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'),
  validate(schema.list), controller.list);
router.post('/interviews',
  requireRole('RECRUITER', 'PLACEMENT_OFFICER', 'ADMIN'),
  validate(schema.create), controller.create);
router.get('/interviews/:id',
  validate(schema.getOne), controller.getById);

module.exports = router;
