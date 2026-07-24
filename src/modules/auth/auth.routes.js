const express = require('express');
const controller = require('./auth.controller');
const authenticate = require('../../shared/middleware/authenticate');
const { loginLimiter, registerLimiter } = require('../../shared/middleware/rateLimit');

const router = express.Router();

router.post('/auth/register', registerLimiter, controller.register);
router.post('/auth/login', loginLimiter, controller.login);
router.post('/auth/refresh', controller.refresh);
router.post('/auth/logout', controller.logout);
router.post('/auth/logout-all', authenticate, controller.logoutEverywhere);
router.get('/auth/me', authenticate, controller.me);

module.exports = router;
