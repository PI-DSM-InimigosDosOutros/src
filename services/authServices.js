const userRepository = require('../repositories/userRepository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { email: normalizeEmail, fail } = require('./validation');
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

function signAuthToken(user) {
    if (!process.env.JWT_SECRET) fail('Autenticação indisponível.', 503);
    return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
}
async function login({ email, password }) {
    if (typeof password !== 'string' || !password) fail('Informe seu e-mail e sua senha.');
    const user = await userRepository.findByEmail(normalizeEmail(email));
    const matches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !matches) fail('E-mail ou senha inválidos.', 401);
    return { token: signAuthToken(user), user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email } };
}
module.exports = { signAuthToken, login };
