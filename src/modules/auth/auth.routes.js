const express = require('express');
const controller = require('./auth.controller');
const authenticate = require('../../shared/middleware/authenticate');
const validate = require('../../shared/middleware/validate');
const schema = require('./auth.schema');
const { loginLimiter, registerLimiter } = require('../../shared/middleware/rateLimit');

const router = express.Router();

router.post('/auth/register', registerLimiter, validate(schema.register), controller.register);
router.post('/auth/login', loginLimiter, validate(schema.login), controller.login);
router.post('/auth/refresh', validate(schema.refresh), controller.refresh);
router.post('/auth/logout', validate(schema.logout), controller.logout);
router.post('/auth/logout-all', authenticate, controller.logoutEverywhere);
router.get('/auth/me', authenticate, controller.me);

module.exports = router;
