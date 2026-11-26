const db = require('../config/database');

const workoutRepository = {
   getDailyWorkoutByUserId: async (userId, date) => {
    const query = `
        SELECT 
            dw.IdDailyWorkout AS dailyworkoutid,
            dw.Date AS date,
            dw.TotalDuration AS totaldurationminutes,
            dwe.ExerciseOrder AS exerciseorder,
            dwe.DurationEstimate AS durationestimate,
            dwe.Completed AS completed,
            w.Name AS workoutname,
            w.MuscleGroup AS musclegroup,
            w.GifUrl AS gifurl,
            ec.Name AS categoryname
        FROM DailyWorkout dw
        LEFT JOIN DailyWorkoutExercise dwe ON dw.IdDailyWorkout = dwe.IdDailyWorkout
        LEFT JOIN Workout w ON dwe.IdWorkout = w.IdWorkout
        LEFT JOIN ExerciseCategory ec ON w.IdExerciseCategory = ec.IdExerciseCategory
        WHERE dw.IdUser = ? AND DATE(dw.Date) = DATE(?)
        ORDER BY dwe.ExerciseOrder ASC;
    `;

    const [rows] = await db.execute(query, [userId, date]);
    

    if (!rows || rows.length === 0) {
        return null;
    }

    const firstRow = rows[0];

    const exercises = rows
        .filter(row => row.exerciseorder !== null && row.exerciseorder !== undefined || row.ExerciseOrder !== null && row.ExerciseOrder !== undefined)
        .map(row => ({
            exerciseOrder: row.exerciseorder ?? row.ExerciseOrder,
            durationEstimate: row.durationestimate ?? row.DurationEstimate,
            completed: row.completed ?? row.Completed,
            workoutName: row.workoutname ?? row.WorkoutName,
            muscleGroup: row.musclegroup ?? row.MuscleGroup,
            gifUrl: row.gifurl ?? row.GifUrl,
            categoryName: row.categoryname ?? row.CategoryName
        }));

        return {
            dailyWorkoutId: firstRow.dailyworkoutid ?? firstRow.DailyWorkoutId,
            date: firstRow.date ?? firstRow.Date,
            totalDurationMinutes: firstRow.totaldurationminutes ?? firstRow.TotalDurationMinutes,
            exercises: exercises
        };
    },
    markNextExerciseAsCompleted: async (dailyWorkoutId) => {
    const [rows] = await db.execute(
        `SELECT 
            IdDailyWorkoutExercise AS iddailyworkoutexercise, 
            ExerciseOrder AS exerciseorder 
         FROM DailyWorkoutExercise 
         WHERE IdDailyWorkout = ? AND (Completed = 0 OR Completed = FALSE) 
         ORDER BY ExerciseOrder ASC 
         LIMIT 1`,
        [dailyWorkoutId]
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    const currentExercise = rows[0];
    
    const exerciseId = currentExercise.iddailyworkoutexercise ?? currentExercise.IdDailyWorkoutExercise;
    const exerciseOrder = currentExercise.exerciseorder ?? currentExercise.ExerciseOrder;

    await db.execute(
        `UPDATE DailyWorkoutExercise 
         SET Completed = 1 
         WHERE IdDailyWorkoutExercise = ?`,
        [exerciseId]
    );

    return exerciseOrder;
},

    finishDailyWorkout: async (dailyWorkoutId) => {
        await db.execute(
            `UPDATE DailyWorkout 
             SET TotalDuration = TotalDuration 
             WHERE IdDailyWorkout = ?`,
            [dailyWorkoutId]
        );
    }
};

module.exports = workoutRepository;