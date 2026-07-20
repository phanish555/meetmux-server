const express = require('express');
const controller = require('./job.controller');

const router = express.Router();

router.get('/jobs', controller.list);
router.post('/jobs', controller.create);
router.get('/jobs/:id', controller.getById);
router.patch('/jobs/:id', controller.update);
router.get('/jobs/:id/applications', controller.listApplicationsForJob);

module.exports = router;
