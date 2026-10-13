const workoutRepository = require('../repositories/workoutRepository');

const workoutService = {
    getWodForUser: async (userId) => {
        if (!userId) {
            throw { status: 400, message: 'User ID not identified.' };
        }

        const currentDate = new Date().toLocaleDateString('en-CA'); 

        const workoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);

        if (!workoutData) {
            throw { status: 404, message: 'No workout found for today.' };
        }

        return workoutData;
    }
};

module.exports = workoutService;