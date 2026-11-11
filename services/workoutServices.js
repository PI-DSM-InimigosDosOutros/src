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
        const currentDate = new Date().toLocaleDateString('en-CA');
        const workoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);

        if (!workoutData) {
            throw { status: 404, message: 'No workout found for today.' };
        }

        return workoutData;
    },

    startWorkout: async (userId) => {
        const currentDate = new Date().toLocaleDateString('en-CA');
        const workoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);

        const workoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);
        if (!workoutData) {
            throw { status: 404, message: 'Error in the creation of daily workout, please try again later.' };
        }

        return {
            message: 'Workout session started successfully.',
            dailyWorkoutId: workoutData.dailyWorkoutId,
            totalDurationMinutes: workoutData.totalDurationMinutes,
            firstExercise: (workoutData.exercises && workoutData.exercises.length > 0) ? workoutData.exercises[0] : null
        };
    },

    updateProgress: async (userId) => {

    const currentDate = new Date().toLocaleDateString('en-CA');
    const workoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);

    if (!workoutData) {
        throw { status: 404, message: 'No active workout session found for today.' };
    }

    const dailyWorkoutId = workoutData.dailyWorkoutId;
    const completedOrder = await workoutRepository.markNextExerciseAsCompleted(dailyWorkoutId);

    if (completedOrder === null) {
        return {
            message: 'All exercises are already completed.',
            isFinished: true,
            nextExercise: null
        };
    }

    const updatedWorkoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);
    const nextExercise = updatedWorkoutData.exercises.find(ex => ex.completed === 0 || ex.completed === false) || null;
    const isFinished = nextExercise === null;

    return {
        message: `Exercise order ${completedOrder} marked as completed.`,
        isFinished,
        nextExercise
    };
},

    finishWorkout: async (userId) => {
        const currentDate = new Date().toLocaleDateString('en-CA');
        const workoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);

        if (!workoutData) {
            throw { status: 404, message: 'No workout session found for today.' };
        }

        await workoutRepository.finishDailyWorkout(workoutData.dailyWorkoutId);
        
        const updatedWorkoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);

        return {
            message: 'Workout finished successfully.',
            summary: {
                dailyWorkoutId: updatedWorkoutData?.dailyWorkoutId,
                totalDurationMinutes: updatedWorkoutData?.totalDurationMinutes,
                exercisesCompleted: updatedWorkoutData?.exercises.filter(ex => ex.completed === 1).length || 0,
                totalExercises: updatedWorkoutData?.exercises.length || 0,
                exercises: updatedWorkoutData?.exercises || []
            }
        };
    }
};

module.exports = workoutService;