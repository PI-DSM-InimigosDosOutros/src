const express = require('express');
const router = express.Router();
const authController = require('../https/authController');

router.post('/token', authController.generateToken);

module.exports = router;