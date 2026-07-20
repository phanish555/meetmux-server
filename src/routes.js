const express = require('express');

const healthRoutes = require('./modules/health/health.routes');
const studentRoutes = require('./modules/students/student.routes');
const companyRoutes = require('./modules/companies/company.routes');
const jobRoutes = require('./modules/jobs/job.routes');
const applicationRoutes = require('./modules/applications/application.routes');
const interviewRoutes = require('./modules/interviews/interview.routes');

const router = express.Router();

router.use(healthRoutes);
router.use(studentRoutes);
router.use(companyRoutes);
router.use(jobRoutes);
router.use(applicationRoutes);
router.use(interviewRoutes);

module.exports = router;
