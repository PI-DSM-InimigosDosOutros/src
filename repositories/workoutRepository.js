const db = require('../config/database');
const ai = require ('servic')


// o usuario sempre deve ter no minimo 1 exericio do dia, gerado após o cadastro
const dailyWorkoutQuery = `
            SELECT IdDailyWorkout, Date, TotalDuration 
            FROM DailyWorkout 
            WHERE IdUser = ? AND Date = ?
            LIMIT 1;
        `;

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

const workoutRepository = {

    findDailyWorkout: async (userId, date) => {
        const [rows] = await db.execute(dailyWorkoutQuery, [userId, date]);
        return rows[0] || null;
    },

    getPreferences: async (userId) => {
        const [[row]] = await db.execute(
            'SELECT * FROM UserPreferences WHERE IdUser = ?', [userId]
        );
        return row || null;
    },

    getCatalog: async () => {
        const [rows] = await db.execute('SELECT IdWorkout, Name, MuscleGroup FROM Workout');
        return rows;
    },

    // cria o DailyWorkout e os exercícios juntos: tudo ou nada
    createDailyWorkoutWithExercises: async (userId, date, exercises) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO DailyWorkout (IdUser, Date, TotalDuration)
                 SELECT ?, ?, up.FreeTimePerDay
                 FROM UserPreferences up
                 WHERE up.IdUser = ?`,
                [userId, date, userId]
            );
            if (result.affectedRows === 0) throw new Error('Preferências do usuário não encontradas');

            const idDailyWorkout = result.insertId;

            for (const { IdWorkout, ExerciseOrder, DurationEstimate } of exercises) {
                await connection.execute(
                    `INSERT INTO DailyWorkoutExercise
                        (IdDailyWorkout, IdWorkout, ExerciseOrder, DurationEstimate)
                     VALUES (?, ?, ?, ?)`,
                    [idDailyWorkout, IdWorkout, ExerciseOrder, DurationEstimate]
                );
            }

            await connection.commit();
            return idDailyWorkout;
        } catch (error) {
            await connection.rollback();
            if (error.code === 'ER_DUP_ENTRY') return null; // outra requisição criou primeiro
            throw error;
        } finally {
            connection.release();
        }
    },

    getDailyWorkoutByUserId: async (userId, date) => {
        const dailyWorkout = await workoutRepository.findDailyWorkout(userId, date);
        if (!dailyWorkout) return null;

        const [exercises] = await db.execute(exercisesQuery, [dailyWorkout.IdDailyWorkout]);

        return {
            dailyWorkoutId: dailyWorkout.IdDailyWorkout,
            date: dailyWorkout.Date,
            totalDurationMinutes: dailyWorkout.TotalDuration,
            exercises,
        };
    },
};

module.exports = workoutRepository;