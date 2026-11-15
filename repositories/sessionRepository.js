const db = require('../config/database');
const transaction = require('./transaction');
const { fail, dateKey } = require('../services/validation');
const { buildProgress } = require('../services/progress');
const profileRepository = require('./profileRepository');

async function getSession(userId, id, connection = db) {
    const [[session]] = await connection.execute(`SELECT IdWorkoutSession AS id, IdDailyWorkout AS dailyWorkoutId,
        DATE_FORMAT(Date, '%Y-%m-%d') AS date, Title AS title, Status AS status, TotalDurationSeconds AS durationSeconds
        FROM WorkoutSession WHERE IdUser=? AND IdWorkoutSession=?`, [userId, id]);
    if (!session) fail('Sessão não encontrada.', 404);
    const [exercises] = await connection.execute(`SELECT ExerciseOrder AS exerciseOrder, Name AS name,
        DurationSeconds AS durationSeconds, Completed AS completed FROM WorkoutSessionExercise WHERE IdWorkoutSession=? ORDER BY ExerciseOrder`, [id]);
    return { ...session, id: String(session.id), dailyWorkoutId: Number(session.dailyWorkoutId), durationSeconds: Number(session.durationSeconds),
        exercises: exercises.map(item => ({ ...item, durationSeconds: Number(item.durationSeconds), completed: Boolean(item.completed) })) };
}
async function history(userId, connection = db) {
    const [rows] = await connection.execute('SELECT IdWorkoutSession AS id FROM WorkoutSession WHERE IdUser=? AND Status<>? ORDER BY Date DESC, IdWorkoutSession DESC', [userId, 'active']);
    const result = [];
    for (const row of rows) result.push(await getSession(userId, row.id, connection));
    return result;
}
async function updateStreak(userId, connection) {
    const sessions = await history(userId, connection);
    const profile = await profileRepository.getProfile(userId, connection);
    const [schedules] = await connection.execute("SELECT DATE_FORMAT(EffectiveDate, '%Y-%m-%d') AS effectiveDate, Days AS days FROM UserScheduleVersion WHERE IdUser=? ORDER BY EffectiveDate", [userId]);
    const progress = buildProgress(sessions, profile.availableDays, dateKey(), schedules.map(item => ({ ...item, days: JSON.parse(item.days) })));
    await connection.execute(`INSERT INTO Streak (IdUser, CurrentStreak, LastWorkoutDate) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE CurrentStreak=VALUES(CurrentStreak), LastWorkoutDate=VALUES(LastWorkoutDate)`, [userId, progress.currentStreak, progress.lastWorkoutDate]);
    return progress;
}
async function progress(userId) {
    return transaction(async connection => {
        await connection.execute('SELECT IdUser FROM User WHERE IdUser=? FOR UPDATE', [userId]);
        return updateStreak(userId, connection);
    });
}
async function active(userId, connection = db) {
    const [[row]] = await connection.execute('SELECT IdWorkoutSession AS id FROM WorkoutSession WHERE IdUser=? AND Status=? ORDER BY IdWorkoutSession DESC LIMIT 1', [userId, 'active']);
    return row ? getSession(userId, row.id, connection) : null;
}
async function start(userId, workout) {
    return transaction(async connection => {
        await connection.execute('SELECT IdUser FROM User WHERE IdUser=? FOR UPDATE', [userId]);
        const existing = await active(userId, connection);
        if (existing) {
            if (existing.dailyWorkoutId !== workout.dailyWorkoutId) fail('Encerre a sessão em andamento antes de iniciar outro treino.', 409);
            return existing;
        }
        const [result] = await connection.execute('INSERT INTO WorkoutSession (IdUser, IdDailyWorkout, Date, Title) VALUES (?, ?, ?, ?)',
            [userId, workout.dailyWorkoutId, dateKey(), 'Treino do dia']);
        for (const item of workout.exercises) await connection.execute(`INSERT INTO WorkoutSessionExercise
            (IdWorkoutSession, IdWorkout, ExerciseOrder, Name) VALUES (?, ?, ?, ?)`, [result.insertId, item.workoutId, item.exerciseOrder, item.workoutName]);
        return getSession(userId, result.insertId, connection);
    });
}
async function complete(userId, sessionId, order, seconds) {
    return transaction(async connection => {
        await connection.execute('SELECT IdUser FROM User WHERE IdUser=? FOR UPDATE', [userId]);
        const session = await getSession(userId, sessionId, connection);
        const exercise = session.exercises.find(item => item.exerciseOrder === order);
        if (!exercise) fail('Exercício não encontrado nesta sessão.', 404);
        // Repetir a mesma conclusão não avança outro exercício nem altera o tempo já gravado.
        if (exercise.completed) return session;
        if (session.status !== 'active') fail('A sessão já foi encerrada.', 409);
        if (session.exercises.find(item => !item.completed)?.exerciseOrder !== order) fail('Conclua o exercício atual antes de avançar.', 409);
        await connection.execute('UPDATE WorkoutSessionExercise SET Completed=1, DurationSeconds=? WHERE IdWorkoutSession=? AND ExerciseOrder=?', [seconds, sessionId, order]);
        await connection.execute('UPDATE DailyWorkoutExercise SET Completed=1 WHERE IdDailyWorkout=? AND ExerciseOrder=?', [session.dailyWorkoutId, order]);
        return getSession(userId, sessionId, connection);
    });
}
async function finish(userId, sessionId, interrupted) {
    return transaction(async connection => {
        await connection.execute('SELECT IdUser FROM User WHERE IdUser=? FOR UPDATE', [userId]);
        const session = await getSession(userId, sessionId, connection);
        if (session.status !== 'active') return session;
        if (interrupted) {
            const item = session.exercises.find(item => item.exerciseOrder === interrupted.exerciseOrder);
            if (!item || item.completed || session.exercises.find(item => !item.completed)?.exerciseOrder !== item.exerciseOrder) fail('Exercício interrompido inválido.');
            await connection.execute('UPDATE WorkoutSessionExercise SET DurationSeconds=? WHERE IdWorkoutSession=? AND ExerciseOrder=?', [interrupted.durationSeconds, sessionId, interrupted.exerciseOrder]);
            item.durationSeconds = interrupted.durationSeconds;
        }
        const status = session.exercises.every(item => item.completed) ? 'completed' : 'ended';
        const duration = session.exercises.reduce((sum, item) => sum + item.durationSeconds, 0);
        await connection.execute('UPDATE WorkoutSession SET Status=?, TotalDurationSeconds=?, FinishedAt=CURRENT_TIMESTAMP WHERE IdWorkoutSession=?', [status, duration, sessionId]);
        await updateStreak(userId, connection);
        return getSession(userId, sessionId, connection);
    });
}
module.exports = { getSession, history, progress, active, start, complete, finish };
