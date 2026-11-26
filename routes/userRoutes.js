const express = require('express');
const router = express.Router();
const userController = require('../https/userController');

router.post('/user/register', userController.register);
router.post('/user/forgot-password', userController.forgotPassword);
router.post('/user/reset-password', userController.resetPassword);

module.exports = router;