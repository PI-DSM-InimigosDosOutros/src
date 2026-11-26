const tracer = require('dd-trace');
const workoutRepository = require('../repositories/workoutRepository');

const workoutService = {
    getWodForUser: async (userId) => {
        const currentDate = new Date().toLocaleDateString('en-CA');
        const workoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);

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
        if (!workoutData) {
            throw { status: 404, message: 'No workout found for today.' };
        }

        return workoutData;
    },

    startWorkout: async (userId) => {
        const currentDate = new Date().toLocaleDateString('en-CA');
        const workoutData = await workoutRepository.getDailyWorkoutByUserId(userId, currentDate);

        if (!workoutData) {
            throw { status: 404, message: 'No workout found for today.' };
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