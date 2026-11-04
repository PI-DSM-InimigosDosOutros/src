const express = require('express');
const router = express.Router();
const authController = require('../https/authController');

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

module.exports = router;