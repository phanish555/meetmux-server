const express = require('express');
const { listStudents, getStudent, createStudent } = require('../controllers/student.controller');

const router = express.Router();

router.get('/students', listStudents);
router.get('/students/:id', getStudent);
router.post('/students', createStudent);

module.exports = router;
