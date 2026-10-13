const db = require('../config/database');

const workoutRepository = {
    getDailyWorkoutByUserId: async (userId, date) => {
        const dailyWorkoutQuery = `
            SELECT IdDailyWorkout, Date, TotalDuration 
            FROM DailyWorkout 
            WHERE IdUser = ? AND Date = ?
            LIMIT 1;
        `;
        const [dailyWorkouts] = await db.execute(dailyWorkoutQuery, [userId, date]);

        if (dailyWorkouts.length === 0) {
            return null;
        }

        const dailyWorkout = dailyWorkouts[0];

        const exercisesQuery = `
            SELECT 
                dwe.ExerciseOrder AS exerciseOrder,
                dwe.DurationEstimate AS durationEstimate,
                dwe.Completed AS completed,
                w.Name AS workoutName,
                w.MuscleGroup AS muscleGroup,
                w.GifUrl AS gifUrl,
                ec.Name AS categoryName
            FROM DailyWorkoutExercise dwe
            JOIN Workout w ON dwe.IdWorkout = w.IdWorkout
            JOIN ExerciseCategory ec ON w.IdExerciseCategory = ec.IdExerciseCategory
            WHERE dwe.IdDailyWorkout = ?
            ORDER BY dwe.ExerciseOrder ASC;
        `;

        const [exercises] = await db.execute(exercisesQuery, [dailyWorkout.IdDailyWorkout]);

        return {
            dailyWorkoutId: dailyWorkout.IdDailyWorkout,
            date: dailyWorkout.Date,
            totalDurationMinutes: dailyWorkout.TotalDuration,
            exercises: exercises
        };
    }
};

module.exports = workoutRepository;