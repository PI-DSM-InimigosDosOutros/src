const workoutService = require('../services/workoutServices');

const workoutController = {
    getWod: async (req, res) => {
        try {
            const userId = req.userId;
            const workout = await workoutService.getWodForUser(userId);

            return res.status(200).json({
                success: true,
                message: 'Workout of the day retrieved successfully.',
                data: workout
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                error: error.message || 'Internal server error.'
            });
        }
    },

    startWorkout: async (req, res) => {
        try {
            const userId = req.userId;
            const session = await workoutService.startWorkout(userId);

            return res.status(200).json({
                success: true,
                message: session.message,
                data: session
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                error: error.message || 'Internal server error.'
            });
        }
    },

    updateProgress: async (req, res) => {
        try {
            const userId = req.userId; 
            
            const progress = await workoutService.updateProgress(userId);

            return res.status(200).json({
                success: true,
                message: progress.message,
                data: progress
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                error: error.message || 'Internal server error.'
            });
        }
    },

    finishWorkout: async (req, res) => {
        try {
            const userId = req.userId;
            const summary = await workoutService.finishWorkout(userId);

            return res.status(200).json({
                success: true,
                message: summary.message,
                data: summary.summary
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                error: error.message || 'Internal server error.'
            });
        }
    }
};

module.exports = workoutController;