const db = require('../config/database');

const workoutRepository = {
   getDailyWorkoutByUserId: async (userId, date, workoutId = null) => {
    const query = `
        SELECT 
            dw.IdDailyWorkout AS dailyworkoutid,
            dw.Date AS date,
            dw.TotalDuration AS totaldurationminutes,
            dwe.ExerciseOrder AS exerciseorder,
            dwe.DurationEstimate AS durationestimate,
            dwe.Completed AS completed,
            w.IdWorkout AS workoutid,
            w.Name AS workoutname,
            w.MuscleGroup AS musclegroup,
            w.GifUrl AS gifurl,
            ec.Name AS categoryname
        FROM DailyWorkout dw
        LEFT JOIN DailyWorkoutExercise dwe ON dw.IdDailyWorkout = dwe.IdDailyWorkout
        LEFT JOIN Workout w ON dwe.IdWorkout = w.IdWorkout
        LEFT JOIN ExerciseCategory ec ON w.IdExerciseCategory = ec.IdExerciseCategory
        WHERE dw.IdUser = ? AND dw.IdDailyWorkout = COALESCE(?,
            (SELECT d.IdDailyWorkout FROM DailyWorkout d WHERE d.IdUser=? AND d.Date=? ORDER BY d.IdDailyWorkout DESC LIMIT 1))
        ORDER BY dwe.ExerciseOrder ASC;
    `;

    const [rows] = await db.execute(query, [userId, workoutId, userId, date]);
    

    if (!rows || rows.length === 0) {
        return null;
    }

    const firstRow = rows[0];

    const exercises = rows
        .filter(row => row.exerciseorder !== null && row.exerciseorder !== undefined || row.ExerciseOrder !== null && row.ExerciseOrder !== undefined)
        .map(row => ({
            exerciseOrder: row.exerciseorder ?? row.ExerciseOrder,
            workoutId: row.workoutid,
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
    create: async (userId, date, exercises, expectedProfile) => require('./transaction')(async connection => {
        const { fail } = require('../services/validation');
        await connection.execute('SELECT IdUser FROM User WHERE IdUser=? FOR UPDATE', [userId]);
        if (await require('./sessionRepository').active(userId, connection)) fail('Encerre o treino em andamento antes de criar outro.', 409);
        const current = await require('./profileRepository').getProfile(userId, connection);
        if (JSON.stringify(current) !== JSON.stringify(expectedProfile)) fail('Seu perfil mudou. Solicite novamente a criação do treino.', 409);
        const [result] = await connection.execute('INSERT INTO DailyWorkout (IdUser, Date, TotalDuration) VALUES (?, ?, ?)',
            [userId, date, exercises.reduce((sum, item) => sum + item.DurationEstimate, 0)]);
        for (const item of exercises) await connection.execute(`INSERT INTO DailyWorkoutExercise (IdDailyWorkout, IdWorkout, ExerciseOrder, DurationEstimate)
            VALUES (?, ?, ?, ?)`, [result.insertId, item.IdWorkout, item.ExerciseOrder, item.DurationEstimate]);
        return result.insertId;
    }),
    catalogue: async (categories) => {
        const [rows] = await db.execute(`SELECT w.IdWorkout, w.Name, w.MuscleGroup, w.GifUrl, c.Name AS CategoryName
            FROM Workout w JOIN ExerciseCategory c ON c.IdExerciseCategory=w.IdExerciseCategory
            WHERE c.Name IN (${categories.map(() => '?').join(',')}) ORDER BY w.IdWorkout`, categories);
        return rows;
    }
};

module.exports = workoutRepository;
