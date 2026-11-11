const express = require('express');
const router = express.Router();
const authController = require('../https/authController');

router.post('/auth/login', authController.login);

module.exports = router;