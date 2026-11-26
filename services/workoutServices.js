const tracer = require('dd-trace');
const workoutRepository = require('../repositories/workoutRepository');
const { getAI, createWorkout } = require('./aiServices');

const workoutService = {

    ensureDailyWorkout: async (userId, date) => {
        return tracer.trace('workout.ensureDaily', async (span) => {
            span?.setTag('workout.date', date);

            const existing = await workoutRepository.findDailyWorkout(userId, date);
            if (existing) {
                span?.setTag('workout.generated', false);
                return; //já existe treino
            }

            const preferences = await workoutRepository.getPreferences(userId);
            if (!preferences) throw { status: 404, message: 'User preferences not found.' };

            const catalog = await workoutRepository.getCatalog();
            span?.setTag('workout.catalog_size', catalog.length);

            const exercises = await getAI(() => createWorkout(preferences, catalog));
            span?.setTag('workout.exercise_count', exercises.length);

            const workoutId = await workoutRepository.createDailyWorkoutWithExercises(userId, date, exercises);
            const generated = Boolean(workoutId);
            span?.setTag('workout.generated', generated);
            if (generated) {
                tracer.dogstatsd.increment('fitness.workout.generated');
            }
        });
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