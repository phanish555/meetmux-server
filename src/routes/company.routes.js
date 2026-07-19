const express = require('express');
const { listCompanies, getCompany } = require('../controllers/company.controller');

const router = express.Router();

router.get('/companies', listCompanies);
router.get('/companies/:id', getCompany);

module.exports = router;
