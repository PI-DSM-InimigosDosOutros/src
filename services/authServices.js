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
            },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        return {
            token: token
        };
    },

    register: async ({ firstName, lastName, birthDate, gender, email, password }) => {
        const normalizedEmail = normalizeEmail(email);

        if (!firstName || !lastName || !birthDate || !gender || !normalizedEmail || !password) {
            throw { status: 400, message: 'firstName, lastName, birthDate, gender, email and password are required.' };
        }

        if (!EMAIL_REGEX.test(normalizedEmail)) {
            throw { status: 400, message: 'Invalid email format.' };
        }

        if (String(gender).trim().length !== 1) {
            throw { status: 400, message: 'Gender must be a single character.' };
        }

        const parsedDate = new Date(birthDate);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || isNaN(parsedDate.getTime()) || parsedDate > new Date()) {
            throw { status: 400, message: 'birthDate must be a valid past date in the format YYYY-MM-DD.' };
        }

        validatePassword(password);

        const existingUser = await userRepository.findByEmail(normalizedEmail);
        if (existingUser) {
            throw { status: 409, message: 'Email already registered.' };
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        let newUser;
        try {
            newUser = await userRepository.createWithLogin({
                firstName: String(firstName).trim(),
                lastName: String(lastName).trim(),
                birthDate,
                gender: String(gender).trim().toUpperCase(),
                email: normalizedEmail,
                passwordHash
            });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw { status: 409, message: 'Email already registered.' };
            }
            throw error;
        }

        return {
            token: signAuthToken(newUser),
            user: {
                id: newUser.id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email
            }
        };
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
    },

    forgotPassword: async (email) => {
        const normalizedEmail = normalizeEmail(email);

        if (!normalizedEmail) {
            throw { status: 400, message: 'Email is required.' };
        }

        const user = await userRepository.findByEmail(normalizedEmail);

        if (user) {
            const resetToken = jwt.sign(
                { id: user.id, purpose: 'password-reset' },
                SECRET_KEY + user.passwordHash,
                { expiresIn: '15m' }
            );

            const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

            try {
                await mailService.sendPasswordResetEmail(user.email, user.firstName, resetLink);
            } catch (error) {
                console.error('Erro ao enviar e-mail de recuperação:', error.message);
            }
        }

        return { message: 'If the email is registered, a recovery link has been sent.' };
    },

    resetPassword: async ({ token, newPassword }) => {
        if (!token || !newPassword) {
            throw { status: 400, message: 'Token and newPassword are required.' };
        }

        validatePassword(newPassword);

        const invalidTokenError = { status: 400, message: 'Invalid or expired recovery token.' };

        const unverified = jwt.decode(token);
        if (!unverified || !unverified.id) {
            throw invalidTokenError;
        }

        const login = await userRepository.findLoginById(unverified.id);
        if (!login) {
            throw invalidTokenError;
        }

        let payload;
        try {
            payload = jwt.verify(token, SECRET_KEY + login.passwordHash);
        } catch (error) {
            throw invalidTokenError;
        }

        if (payload.purpose !== 'password-reset') {
            throw invalidTokenError;
        }

        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await userRepository.updatePasswordByUserId(login.id, passwordHash);

        return { message: 'Password updated successfully.' };
    }
};

module.exports = authService;