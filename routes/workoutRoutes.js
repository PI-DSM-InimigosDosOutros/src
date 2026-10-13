const express = require('express');
const router = express.Router();
const workoutController = require('../https/workoutController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/wod', authMiddleware, workoutController.getWod);

module.exports = router;