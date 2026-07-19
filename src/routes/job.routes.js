const express = require('express');
const { listJobs, getJob } = require('../controllers/job.controller');

const router = express.Router();

router.get('/jobs', listJobs);
router.get('/jobs/:id', getJob);

module.exports = router;
