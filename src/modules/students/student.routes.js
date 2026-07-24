const express = require('express');
const controller = require('./student.controller');
const { requireRole } = require('../../shared/middleware/authorize');

const router = express.Router();

router.get('/students', requireRole('PLACEMENT_OFFICER', 'ADMIN', 'RECRUITER'), controller.list);
router.get('/students/:id', controller.getById);
router.post('/students', requireRole('ADMIN'), controller.create); // signup goes via /auth/register
router.patch('/students/:id', controller.update);
router.get('/students/:id/applications', controller.listApplicationsForStudent);

module.exports = router;
