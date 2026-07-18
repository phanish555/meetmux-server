const express = require('express');
const { listUsers, getUser } = require('../controllers/user.controller');

const router = express.Router();

router.get('/users', listUsers);
router.get('/users/:id', getUser);

module.exports = router;
