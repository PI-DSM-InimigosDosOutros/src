const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require.resolve('../config/database');
const commands = [];
let failInsert = false, commits = 0, rollbacks = 0;
const connection = { beginTransaction: async () => {}, commit: async () => { commits++; }, rollback: async () => { rollbacks++; }, release() {},
    execute: async (sql, args) => {
        commands.push({ sql, args });
        if (sql.includes('FROM ExerciseCategory') && !sql.includes('JOIN')) return [[{ id: 92, name: 'Calistenia' }]];
        if (sql.includes('FROM DaysWeek') && !sql.includes('JOIN')) return [[{ id: 41, name: 'Segunda' }, { id: 87, name: 'Domingo' }]];
        if (sql.startsWith('INSERT INTO User (')) return [{ insertId: 7 }];
        if (sql.startsWith('INSERT INTO UserLogin') && failInsert) throw new Error('Falha de gravação');
        if (sql.startsWith('SELECT IdUserPreferences')) return [[{ id: 12 }]];
        if (sql.includes('FROM User u JOIN')) return [[{ firstName: 'Pessoa', lastName: 'Teste', birthDate: '2000-01-01', gender: 'N', email: 'teste@example.com', goal: null, availableMinutesPerDay: null, activityLevel: null, medicalNotes: null }]];
        if (sql.includes('SELECT Height AS') || sql.includes('JOIN UserPreferencesCategory') || sql.includes('JOIN UserAvailableDay')) return [[]];
        return [{}];
    } };
require.cache[path] = { id: path, filename: path, loaded: true, exports: { ...connection, getConnection: async () => connection } };
const users = require('../repositories/userRepository');
const profiles = require('../repositories/profileRepository');
const profile = { firstName: 'Pessoa', lastName: 'Teste', birthDate: '2000-01-01', gender: 'N', email: 'teste@example.com', passwordHash: 'hash',
    heightCm: 170, weightKg: 70, goal: 'Criar rotina', availableMinutesPerDay: 20, activityLevel: null, medicalNotes: null, exerciseCategories: ['Calistenia'], availableDays: [1, 7] };
test('cadastro completo é atômico e usa IDs reais de modalidades e dias, sem presumir a ordem do auto_increment', async () => {
    await users.createWithLogin(profile);
    assert.equal(commits, 1);
    assert.deepEqual(commands.filter(item => item.sql.startsWith('INSERT INTO UserAvailableDay')).map(item => item.args[1]), [41, 87]);
    assert.deepEqual(commands.find(item => item.sql.startsWith('INSERT INTO UserPreferencesCategory')).args, [12, 92]);
    assert.ok(commands.some(item => item.sql.startsWith('INSERT INTO Streak')));
    failInsert = true;
    await assert.rejects(users.createWithLogin(profile));
    failInsert = false;
    assert.equal(rollbacks, 1); assert.equal(commits, 1);
});
test('perfil legado pode editar dados pessoais sem inventar medidas nem apagar preferências', async () => {
    commands.length = 0;
    await profiles.update(7, { fullName: 'Pessoa Alterada' });
    assert.ok(commands.some(item => item.sql.startsWith('UPDATE User SET')));
    assert.equal(commands.some(item => item.sql.startsWith('INSERT INTO UserMeasures')), false);
    assert.equal(commands.some(item => item.sql.startsWith('DELETE FROM UserPreferencesCategory')), false);
    assert.equal(commands.some(item => item.sql.startsWith('DELETE FROM UserAvailableDay')), false);
});
