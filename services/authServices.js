const userRepository = require('../repositories/userRepository');
const mailService = require('./mailServices');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = bcrypt.hashSync('dummy-password', SALT_ROUNDS);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const tracer = require('dd-trace');

const validatePassword = (password) => {
    if (!password || typeof password !== 'string' || password.length < 8) {
        throw { status: 400, message: 'Password must have at least 8 characters.' };
    }
};

const signAuthToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email },
        SECRET_KEY,
        { expiresIn: '1h' }
    );
};

const authService = {
    generateTokenByEmail: async (email) => {
        if (!email) {
            throw { status: 400, message: 'Email parameter is required.' };
        }

        const user = await userRepository.findByEmail(email);

        if (!user) {
            throw { status: 404, message: 'User not found with the provided email.' };
        }

        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                name: `${user.firstName} ${user.lastName}`
            },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        return {
            token: token
        };
    },

    signAuthToken: (user)=>{
        return jwt.sign(
        { id: user.id, email: user.email },
        SECRET_KEY,
        { expiresIn: '1h' }
        );
    },

    login: async ({ email, password }) => {
        const span = tracer.scope().active();
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail || !password) {
            throw { status: 400, message: 'Email and password are required.' };
        }

        const user = await userRepository.findByEmail(normalizedEmail);

        const passwordMatches = await bcrypt.compare(String(password), user ? user.passwordHash : DUMMY_HASH);

        if (!user || !passwordMatches) {
            span?.setTag('auth.login_failed', true);
            throw { status: 401, message: 'Invalid email or password.' };
        }

        span?.setTag('auth.login_failed', false);

        return {
            token: signAuthToken(user),
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            }
        };
    }

};

module.exports = authService;