const express = require('express');
const controller = require('./company.controller');

const router = express.Router();

router.get('/companies', controller.list);
router.post('/companies', controller.create);
router.get('/companies/:id', controller.getById);
router.patch('/companies/:id', controller.update);
router.get('/companies/:id/jobs', controller.listJobsForCompany);

module.exports = router;
