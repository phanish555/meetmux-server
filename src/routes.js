const express = require('express');
const authenticate = require('./shared/middleware/authenticate');

const healthRoutes = require('./modules/health/health.routes');
const authRoutes = require('./modules/auth/auth.routes');
const studentRoutes = require('./modules/students/student.routes');
const companyRoutes = require('./modules/companies/company.routes');
const jobRoutes = require('./modules/jobs/job.routes');
const applicationRoutes = require('./modules/applications/application.routes');
const interviewRoutes = require('./modules/interviews/interview.routes');

const router = express.Router();

// Public: health probes and auth
router.use(healthRoutes);
router.use(authRoutes);

// Everything below requires a valid access token
router.use(authenticate);
router.use(studentRoutes);
router.use(companyRoutes);
router.use(jobRoutes);
router.use(applicationRoutes);
router.use(interviewRoutes);

module.exports = router;
