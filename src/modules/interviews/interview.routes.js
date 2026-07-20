const express = require('express');
const controller = require('./interview.controller');

const router = express.Router();

router.get('/interviews', controller.list);
router.post('/interviews', controller.create);
router.get('/interviews/:id', controller.getById);

module.exports = router;
