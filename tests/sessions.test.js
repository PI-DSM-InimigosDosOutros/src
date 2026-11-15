const { test } = require('node:test');
const assert = require('node:assert/strict');
// Executor controlado: verifica o contrato e as transições, sem simular validação do motor MySQL.
const state = { sessions: [], exercises: [], streakWrites: 0, commits: 0, rollbacks: 0 };
const connection = {
    beginTransaction: async () => {}, commit: async () => { state.commits++; }, rollback: async () => { state.rollbacks++; }, release() {},
    execute: async (sql, args = []) => {
        if (sql.startsWith('SELECT IdUser FROM')) return [[{ IdUser: args[0] }]];
        if (sql.startsWith('INSERT INTO WorkoutSession (')) {
            const id = state.sessions.length + 1;
            state.sessions.push({ id, userId: args[0], dailyWorkoutId: args[1], date: args[2], title: args[3], status: 'active', durationSeconds: 0 });
            return [{ insertId: id }];
        }
        if (sql.includes('INSERT INTO WorkoutSessionExercise')) {
            state.exercises.push({ sessionId: args[0], exerciseOrder: args[2], name: args[3], completed: false, durationSeconds: 0 }); return [{}];
        }
        if (sql.startsWith('SELECT IdWorkoutSession AS id, IdDailyWorkout')) return [state.sessions.filter(item => item.userId === args[0] && item.id === Number(args[1]))];
        if (sql.includes('FROM WorkoutSessionExercise WHERE')) return [state.exercises.filter(item => item.sessionId === Number(args[0])).map(item => ({ ...item }))];
        if (sql.startsWith('SELECT IdWorkoutSession AS id FROM WorkoutSession')) {
            return [state.sessions.filter(item => item.userId === args[0] && (sql.includes('Status<>') ? item.status !== args[1] : item.status === args[1])).map(item => ({ id: item.id })).reverse().slice(0, sql.includes('LIMIT 1') ? 1 : state.sessions.length)];
        }
        if (sql.startsWith('UPDATE WorkoutSessionExercise')) {
            const exercise = state.exercises.find(item => item.sessionId === Number(args[1]) && item.exerciseOrder === args[2]);
            if (sql.includes('Completed=1')) exercise.completed = true;
            exercise.durationSeconds = args[0]; return [{}];
        }
        if (sql.startsWith('UPDATE DailyWorkoutExercise')) return [{}];
        if (sql.startsWith('UPDATE WorkoutSession SET')) {
            Object.assign(state.sessions.find(item => item.id === Number(args[2])), { status: args[0], durationSeconds: args[1] }); return [{}];
        }
        if (sql.includes('INSERT INTO Streak')) { state.streakWrites++; return [{}]; }
        if (sql.includes('FROM UserScheduleVersion')) return [[]];
        throw new Error('Consulta não coberta pelo teste: ' + sql);
    },
};
const path = require.resolve('../config/database');
require.cache[path] = { id: path, filename: path, loaded: true, exports: { ...connection, getConnection: async () => connection } };
const profiles = require('../repositories/profileRepository');
const sessions = require('../repositories/sessionRepository');
const workouts = require('../repositories/workoutRepository');
const service = require('../services/workoutServices');

test('início repetido reaproveita sessão; conclusão é por exercício e idempotente; resumo persiste tempo e proprietário', async t => {
    t.mock.method(profiles, 'getProfile', async () => ({ availableDays: [1, 3, 5] }));
    const workout = { dailyWorkoutId: 42, exercises: [{ workoutId: 4, exerciseOrder: 1, workoutName: 'Agachamento' }, { workoutId: 5, exerciseOrder: 2, workoutName: 'Flexão' }] };
    const first = await sessions.start(1, workout);
    assert.equal((await sessions.start(1, workout)).id, first.id);
    assert.equal(state.sessions.length, 1);
    await assert.rejects(sessions.complete(1, first.id, 2, 10), error => error.status === 409);
    await assert.rejects(sessions.complete(2, first.id, 1, 10), error => error.status === 404);
    await sessions.complete(1, first.id, 1, 12.5);
    const duplicate = await sessions.complete(1, first.id, 1, 99);
    assert.equal(duplicate.exercises[0].durationSeconds, 12.5);
    assert.equal(duplicate.exercises[1].completed, false);
    const ended = await sessions.finish(1, first.id, { exerciseOrder: 2, durationSeconds: 3.25 });
    assert.equal(ended.status, 'ended'); assert.equal(ended.durationSeconds, 15.75);
    await sessions.finish(1, first.id, null);
    assert.equal(state.streakWrites, 1);
    const second = await sessions.start(1, workout);
    await sessions.complete(1, second.id, 1, 5);
    await sessions.complete(1, second.id, 2, 7);
    assert.equal((await sessions.finish(1, second.id, null)).status, 'completed');
    assert.equal((await sessions.history(1)).length, 2);
    assert.equal((await sessions.history(2)).length, 0);
    assert.ok(state.rollbacks >= 2);
});
test('serviço exige IDs e tempo em segundos; não existe conclusão implícita do próximo pendente', async () => {
    await assert.rejects(service.updateProgress(1, {}), error => error.status === 400);
    await assert.rejects(service.updateProgress(1, { sessionId: 1, exerciseOrder: 1, durationSeconds: -2 }), error => error.status === 400);
});
test('consulta de treino identifica um treino específico e não mistura registros do mesmo dia', async t => {
    const db = require('../config/database');
    t.mock.method(db, 'execute', async (sql, args) => {
        assert.match(sql, /IdDailyWorkout = COALESCE/); assert.match(sql, /ORDER BY d.IdDailyWorkout DESC LIMIT 1/);
        assert.deepEqual(args, [1, 42, 1, '2026-11-15']);
        return [[{ dailyworkoutid: 42, date: '2026-11-15', totaldurationminutes: 5, exerciseorder: 1, workoutid: 4, durationestimate: 5, completed: 0, workoutname: 'Teste', musclegroup: 'Pernas', categoryname: 'Calistenia', gifurl: null }]];
    });
    const result = await workouts.getDailyWorkoutByUserId(1, '2026-11-15', 42);
    assert.equal(result.dailyWorkoutId, 42); assert.equal(result.exercises.length, 1);
});
