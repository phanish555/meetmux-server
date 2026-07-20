const express = require('express');
const controller = require('./application.controller');

const router = express.Router();

router.get('/applications', controller.list);
router.post('/applications', controller.create);
router.get('/applications/:id', controller.getById);
router.patch('/applications/:id/status', controller.patchStatus);
router.post('/applications/:id/withdrawal', controller.withdraw);
router.get('/applications/:id/interviews', controller.listInterviewsForApplication);

module.exports = router;
