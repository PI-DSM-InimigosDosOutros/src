const workoutRepository = require('../repositories/workoutRepository');

const workoutService = {
    getWodForUser: async (userId) => {
        if (!userId) {
            throw { status: 400, message: 'User ID not identified.' };
        }

        const currentDate = new Date().toLocaleDateString('pt-BR'); 

        const workoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);

        if (!workoutData) {
            throw { status: 404, message: 'Error in the creation of daily workout, please try again later.' };
        }

        return workoutData;
    }
};

module.exports = workoutService;