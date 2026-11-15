const { test } = require('node:test');
const assert = require('node:assert/strict');
const validation = require('../services/validation');
const { validarTreino } = require('../services/aiServices');
const { buildProgress } = require('../services/progress');
const input = () => ({ fullName: 'Pessoa Teste', birthDate: '2000-02-29', gender: 'Não binário', email: 'Pessoa@example.com',
    heightCm: 170.5, weightKg: 70.2, goal: 'Criar rotina', exerciseCategories: ['Flexibilidade'], availableMinutesPerDay: 20,
    availableDays: [7, 1], activityLevel: 'Pratico ocasionalmente', medicalNotes: null });
test('perfil completo normaliza nomes, gênero, unidades, e-mail e dias', () => {
    const result = validation.profile(input());
    assert.equal(result.firstName, 'Pessoa'); assert.equal(result.lastName, 'Teste');
    assert.equal(result.gender, 'N'); assert.equal(result.email, 'pessoa@example.com');
    assert.deepEqual(result.availableDays, [1, 7]); assert.equal(result.heightCm, 170.5);
    assert.equal(result.activityLevel, 'Pratico ocasionalmente');
});
test('validação rejeita datas impossíveis, medidas que não cabem no SQL e modalidades ausentes', () => {
    for (const patch of [{ birthDate: '2000-02-31' }, { birthDate: '2100-01-01' }, { weightKg: 1000 }, { heightCm: 0.001 }, { exerciseCategories: ['Yoga'] }, { gender: 'Outro' }, { availableDays: [0] }, { availableMinutesPerDay: 2.5 }, { goal: 'x'.repeat(1001) }]) {
        assert.throws(() => validation.profile({ ...input(), ...patch }), error => error.status === 400);
    }
});
test('senha segue exatamente os requisitos do frontend', () => {
    validation.password('Teste123!');
    for (const value of ['teste123!', 'TESTE!!!!', 'Teste1234', 'MuitoLonga123456789!']) assert.throws(() => validation.password(value));
});
test('IA só aceita IDs do catálogo, ordens sequenciais e minutos inteiros dentro da disponibilidade', () => {
    const catalog = [{ IdWorkout: 4 }], good = { exercises: [{ IdWorkout: 4, ExerciseOrder: 1, DurationEstimate: 3 }] };
    assert.equal(validarTreino(good, catalog, 5).length, 1);
    for (const exercises of [[], [{ IdWorkout: 99, ExerciseOrder: 1, DurationEstimate: 2 }], [{ IdWorkout: 4, ExerciseOrder: 2, DurationEstimate: 2 }], [{ IdWorkout: 4, ExerciseOrder: 1, DurationEstimate: 1.5 }], [{ IdWorkout: 4, ExerciseOrder: 1, DurationEstimate: 10 }]]) assert.throws(() => validarTreino({ exercises }, catalog, 5));
});
test('sequência distingue treino integral, parcial e dia programado perdido', () => {
    const history = [{ date: '2026-11-13', status: 'completed' }];
    assert.equal(buildProgress(history, [1, 3, 5], '2026-11-15').currentStreak, 1);
    assert.equal(buildProgress(history, [1, 3, 5], '2026-11-17').currentStreak, 0);
    assert.equal(buildProgress([{ ...history[0], status: 'ended' }], [1, 3, 5], '2026-11-15').currentStreak, 0);
});
test('mudança de disponibilidade não altera a programação dos dias anteriores', () => {
    const history = [{ date: '2026-11-13', status: 'completed' }];
    const schedules = [{ effectiveDate: '2026-11-13', days: [5] }, { effectiveDate: '2026-11-15', days: [6, 7] }];
    assert.equal(buildProgress(history, [6, 7], '2026-11-15', schedules).currentStreak, 1);
});
