const express = require('express');
const controller = require('./student.controller');

const router = express.Router();

router.get('/students', controller.list);
router.post('/students', controller.create);
router.get('/students/:id', controller.getById);
router.patch('/students/:id', controller.update);
router.get('/students/:id/applications', controller.listApplicationsForStudent);

module.exports = router;
