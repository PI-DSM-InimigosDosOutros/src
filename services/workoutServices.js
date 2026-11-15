const workouts = require('../repositories/workoutRepository');
const sessions = require('../repositories/sessionRepository');
const profiles = require('../repositories/profileRepository');
const { fail, positiveId, dateKey } = require('./validation');
function seconds(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 999999999) fail('Tempo de exercício inválido.');
    return Math.round(value * 1000) / 1000;
}
async function getWodForUser(userId) {
    const activeSession = await sessions.active(userId);
    const workout = await workouts.getDailyWorkoutByUserId(userId, dateKey(), activeSession?.dailyWorkoutId || null);
    if (!workout) fail('Não há treino disponível para hoje.', 404);
    return { ...workout, activeSession, exercises: workout.exercises.map(item => ({ ...item,
        completed: activeSession?.exercises.find(exercise => exercise.exerciseOrder === item.exerciseOrder)?.completed ? 1 : 0 })) };
}
async function createWorkout(userId) {
    const profile = await profiles.getProfile(userId);
    const today = dateKey();
    const day = new Date(today + 'T12:00:00Z').getUTCDay() || 7;
    if (!profile.availableDays.includes(day)) fail('Hoje não é um dia programado. Ajuste sua disponibilidade para treinar hoje.', 409);
    if (!profile.goal || !profile.exerciseCategories.length || !profile.availableMinutesPerDay) fail('Complete suas preferências antes de criar o treino.', 409);
    if (await sessions.active(userId)) fail('Encerre o treino em andamento antes de criar outro.', 409);
    const catalogue = await workouts.catalogue(profile.exerciseCategories);
    if (!catalogue.length) fail('Não há exercícios cadastrados para as modalidades escolhidas.', 409);
    const exercises = await require('./aiServices').createWorkout({ ...profile, FreeTimePerDay: profile.availableMinutesPerDay }, catalogue);
    const id = await workouts.create(userId, today, exercises, profile);
    return { ...await workouts.getDailyWorkoutByUserId(userId, today, id), activeSession: null };
}
async function startWorkout(userId, body) {
    const id = positiveId(body.dailyWorkoutId, 'Treino');
    const workout = await workouts.getDailyWorkoutByUserId(userId, dateKey(), id);
    if (!workout?.exercises.length) fail('Treino não encontrado.', 404);
    const session = await sessions.start(userId, workout);
    return { dailyWorkoutId: id, session, firstExercise: workout.exercises.find(item => !session.exercises.find(ex => ex.exerciseOrder === item.exerciseOrder)?.completed) || null };
}
async function updateProgress(userId, body) {
    const session = await sessions.complete(userId, positiveId(body.sessionId, 'Sessão'), positiveId(body.exerciseOrder, 'Ordem'), seconds(body.durationSeconds));
    const next = session.exercises.find(item => !item.completed);
    return { isFinished: !next, nextExercise: next || null, session };
}
async function finishWorkout(userId, body) {
    const interrupted = body.interruptedExercise ? {
        exerciseOrder: positiveId(body.interruptedExercise.exerciseOrder, 'Ordem'), durationSeconds: seconds(body.interruptedExercise.durationSeconds)
    } : null;
    return sessions.finish(userId, positiveId(body.sessionId, 'Sessão'), interrupted);
}
module.exports = { getWodForUser, createWorkout, startWorkout, updateProgress, finishWorkout,
    history: userId => sessions.history(userId), progress: userId => sessions.progress(userId) };
