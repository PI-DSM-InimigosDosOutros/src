const db = require('../config/database');


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

    createDailyWorkoutByUserId: async (userId, date) => {
        const connection = await db.getConnection();

        const [dailyWorkouts] = await db.execute(dailyWorkoutQuery, [userId, date]);

        if (dailyWorkouts.length !== 0) {
            return true; //já existe treino
        }

        //if === 0
        try{
            await connection.beginTransaction();

            await connection.execute(
                `INSERT INTO DailyWorkout (IdUser, Date, TotalDuration) 
                    SELECT ?, ?, up.FreeTimePerDay
                    FROM UserPreferences up 
                    WHERE IdUser = ?;`,
                [userId, date, userId]
            );
 
            await connection.commit();

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        try{
            await connection.beginTransaction();

            await getAI(async () => {

                const r = await createWorkout(/* ... */);
                //preciso que retorne: IdWorkout, ExerciseOrder, DurationEstimate

                if (!r) throw new Error('Error when request AI');

                return r;
            });

            await connection.execute(
                
                `INSERT INTO DailyWorkoutExercise 
                    (IdDailyWorkout, IdWorkout, ExerciseOrder, DurationEstimate) 
                    SELECT dw.IdDailyWorkout AS IdDailyWorkout, ? AS IdWorkout, ? AS ExerciseOrder, ? AS DurationEstimate
                    FROM DailyWorkout dw
                    WHERE dw.IdUser = ? AND dw.Date = ?;`,
                [IdWorkout, ExerciseOrder, DurationEstimate, userId, date]
                
            );


                    `
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
                    `
 
            await connection.commit();
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    },

    getDailyWorkoutByUserId: async (userId, date) => {

        const createdDailyWorkout = await createDailyWorkoutByUserId(userId, date);

        if (createdDailyWorkout === false){
            return null;
        }

        //chamado de função aqui que vai gerar o treino
        // essa função vai primeiro criar registro em dailyworkout com o id do user e a data corrente
        // depois vai gerar com IA o treino em dailyworkoutexercise
        // evitar criar mais de 1 treino pro mesmo dia, ex: exercio pos cadastro criado mas abri 
        // pra ve o treino, essa chamada é uma execeção que nao deve ser criada de novo
        // data sem hora para facilitar a comparação


        //valida se o treino recém criado realmente foi criado
        //importante que isso aqui pra frente só ocorra quando a função de gerar treino retornar

        const [dailyWorkouts] = await db.execute(dailyWorkoutQuery, [userId, date]);

        if (dailyWorkouts.length === 0) {
            return null;
        }

        const dailyWorkout = dailyWorkouts[0]; 

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