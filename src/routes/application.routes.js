const express = require('express');
const {
  listApplications,
  getApplication,
  createApplication,
  patchApplication,
} = require('../controllers/application.controller');

const router = express.Router();

router.get('/applications', listApplications);
router.get('/applications/:id', getApplication);
router.post('/applications', createApplication);
router.patch('/applications/:id', patchApplication);

module.exports = router;
