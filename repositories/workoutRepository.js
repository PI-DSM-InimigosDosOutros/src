const db = require('../config/database');


// o usuario sempre deve ter no minimo 1 exericio do dia, gerado após o cadastro

const workoutRepository = {
    getDailyWorkoutByUserId: async (userId, date) => {
        // aqui ele checa se o usuario tem exericio do dia, desnecessario pois ao chamar
        // essa requisição, um exericio será gerado, entao sempre será true, contudo pode
        //ter validação caso ocorra erro na geração dos treiinos


        //chamado de função aqui que vai gerar o treino
        // essa função vai primeiro criar registro em dailyworkout com o id do user e a data corrente
        // depois vai gerar com IA o treino em dailyworkoutexercise
        // evitar criar mais de 1 treino pro mesmo dia, ex: exercio pos cadastro criado mas abri 
        // pra ve o treino, essa chamada é uma execeção que nao deve ser criada de novo


        //valida se o treino recém criado realmente foi criado
        //importante que isso aqui pra frente só ocorra quando a função de gerar treino retornar
        const dailyWorkoutQuery = `
            SELECT IdDailyWorkout, Date, TotalDuration 
            FROM DailyWorkout 
            WHERE IdUser = ? AND Date = ?
            LIMIT 1;
        `; //copular DailyWorkout
        const [dailyWorkouts] = await db.execute(dailyWorkoutQuery, [userId, date]);

        if (dailyWorkouts.length === 0) {
            return null;
        }

        const dailyWorkout = dailyWorkouts[0]; //garantindo top 1

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
        `; //aqui esta retornando uma cadeia de treinos
        //copular DailyWorkoutExercise

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