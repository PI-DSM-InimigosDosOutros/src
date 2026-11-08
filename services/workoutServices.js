const workoutRepository = require('../repositories/workoutRepository');
const { getAI, createWorkout } = require('./aiServices');

const workoutService = {

    ensureDailyWorkout: async (userId, date) => {
        const existing = await workoutRepository.findDailyWorkout(userId, date);
        if (existing) return; //já existe treino

        const preferences = await workoutRepository.getPreferences(userId);
        if (!preferences) throw { status: 404, message: 'User preferences not found.' };

        const catalog = await workoutRepository.getCatalog();

        const exercises = await getAI(() => createWorkout(preferences, catalog));

        await workoutRepository.createDailyWorkoutWithExercises(userId, date, exercises);
    },

    getWodForUser: async (userId) => {
        if (!userId) throw { status: 400, message: 'User ID not identified.' };

        const currentDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

        await workoutService.ensureDailyWorkout(userId, currentDate);

        const workoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);
        if (!workoutData) {
            throw { status: 404, message: 'Error in the creation of daily workout, please try again later.' };
        }

        return workoutData;
    },
};

module.exports = workoutService;