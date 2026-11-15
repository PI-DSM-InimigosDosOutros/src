const express = require('express');
const router = express.Router();
const workoutController = require('../https/workoutController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/wod', authMiddleware, workoutController.getWod);
router.post('/workout/create', authMiddleware, workoutController.createWorkout);
router.get('/workout/history', authMiddleware, workoutController.history);
router.get('/workout/metrics', authMiddleware, workoutController.progress);
router.post('/workout/start', authMiddleware, workoutController.startWorkout);
router.post('/workout/progress', authMiddleware, workoutController.updateProgress);
router.post('/workout/finish', authMiddleware, workoutController.finishWorkout);

module.exports = router;
