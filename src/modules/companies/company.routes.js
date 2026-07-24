const express = require('express');
const controller = require('./company.controller');
const { requireRole } = require('../../shared/middleware/authorize');

const router = express.Router();

router.get('/companies', controller.list);
router.get('/companies/:id', controller.getById);
router.post('/companies', requireRole('PLACEMENT_OFFICER', 'ADMIN'), controller.create);
router.patch('/companies/:id', requireRole('PLACEMENT_OFFICER', 'ADMIN', 'RECRUITER'), controller.update);
router.get('/companies/:id/jobs', controller.listJobsForCompany);

module.exports = router;
