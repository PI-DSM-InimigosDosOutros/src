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
    }
};

module.exports = workoutController;