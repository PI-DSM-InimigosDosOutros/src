const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
process.env.JWT_SECRET = 'workin-test-secret-not-for-deployment';
delete process.env.SMTP_HOST;
delete process.env.GEMINI_API_KEY;
const path = require.resolve('../config/database');
require.cache[path] = { id: path, filename: path, loaded: true, exports: {} };
const users = require('../repositories/userRepository');
const profiles = require('../repositories/profileRepository');
const sessions = require('../repositories/sessionRepository');
const workouts = require('../repositories/workoutRepository');
const app = require('../app');

test('rotas HTTP: token inseguro bloqueado, cadastro completo, login, perfil, senha e serviços sem configuração', async t => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    let token;
    const request = async (path, body, method) => {
        const response = await fetch(base + path, { method: method || (body ? 'POST' : 'GET'),
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, json: await response.json() };
    };
    assert.equal((await request('/token?email=teste@example.com', {})).status, 410);
    for (const path of ['/user/profile', '/workout/history', '/workout/metrics']) assert.equal((await request(path)).status, 401);
    const account = { id: 7, firstName: 'Pessoa', lastName: 'Teste', email: 'teste@example.com', passwordHash: await bcrypt.hash('Teste123!', 4) };
    const input = { fullName: 'Pessoa Teste', birthDate: '2000-01-01', gender: 'Não binário', email: account.email, password: 'Teste123!',
        heightCm: 170, weightKg: 70, goal: 'Criar rotina', medicalNotes: null, activityLevel: 'Pratico ocasionalmente',
        exerciseCategories: ['Calistenia'], availableMinutesPerDay: 20, availableDays: [1, 2, 3, 4, 5, 6, 7] };
    t.mock.method(users, 'findByEmail', async email => email === account.email ? account : null);
    t.mock.method(users, 'createWithLogin', async profile => {
        assert.equal(profile.gender, 'N'); assert.equal(profile.heightCm, 170); assert.equal(profile.availableMinutesPerDay, 20);
        assert.equal(profile.password, undefined); assert.notEqual(profile.passwordHash, input.password);
        return { id: account.id, firstName: profile.firstName, lastName: profile.lastName, email: profile.email };
    });
    const registered = await request('/user/register', input);
    assert.equal(registered.status, 201); assert.equal(registered.json.data.user.passwordHash, undefined);
    assert.equal((await request('/user/register', { ...input, password: 'invalid' })).status, 400);
    assert.equal((await request('/auth/login', { email: account.email, password: 'wrong' })).status, 401);
    const logged = await request('/auth/login', { email: account.email, password: 'Teste123!' });
    assert.equal(logged.status, 200); token = logged.json.data.token;
    t.mock.method(profiles, 'getProfile', async id => { assert.equal(id, 7); return input; });
    t.mock.method(profiles, 'update', async (id, patch) => { assert.equal(id, 7); assert.equal(patch.weightKg, 71); return { ...input, ...patch }; });
    assert.equal((await request('/user/profile')).json.data.fullName, 'Pessoa Teste');
    assert.equal((await request('/user/profile', { weightKg: 71 }, 'PUT')).json.data.weightKg, 71);
    t.mock.method(users, 'findLoginById', async () => account);
    t.mock.method(users, 'updatePasswordByUserId', async (id, hash) => { assert.equal(id, 7); account.passwordHash = hash; });
    assert.equal((await request('/user/change-password', { currentPassword: 'wrong', newPassword: 'Nova123!' })).status, 400);
    assert.equal((await request('/user/change-password', { currentPassword: 'Teste123!', newPassword: 'Nova123!' })).status, 200);
    assert.equal((await request('/auth/login', { email: account.email, password: 'Teste123!' })).status, 401);
    assert.equal((await request('/auth/login', { email: account.email, password: 'Nova123!' })).status, 200);
    assert.equal((await request('/user/forgot-password', { email: account.email })).status, 503);
    t.mock.method(sessions, 'active', async () => null);
    t.mock.method(workouts, 'catalogue', async () => [{ IdWorkout: 4 }]);
    assert.equal((await request('/workout/create', {})).status, 503);
    assert.equal((await request('/workout/progress', {})).status, 400);
});
