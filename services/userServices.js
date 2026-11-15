const userRepository = require('../repositories/userRepository');
const authService = require('./authServices');
const mailService = require('./mailServices');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;

const validation = require('./validation');
const SALT_ROUNDS = 10;

const userService = {

    register: async (input) => {
        const profile = validation.profile(input);
        validation.password(input.password);
        if (!process.env.JWT_SECRET) validation.fail('Autenticação indisponível.', 503);
        const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
        const newUser = await userRepository.createWithLogin({ ...profile, passwordHash });
        return { token: authService.signAuthToken(newUser), user: newUser };
    },

    getProfile: userId => require('../repositories/profileRepository').getProfile(userId),
    updateProfile: (userId, input) => require('../repositories/profileRepository').update(userId, input),
    changePassword: async (userId, { currentPassword, newPassword }) => {
        validation.password(newPassword);
        const login = await userRepository.findLoginById(userId);
        if (!login || typeof currentPassword !== 'string' || !await bcrypt.compare(currentPassword, login.passwordHash)) validation.fail('Senha atual incorreta.', 400);
        await userRepository.updatePasswordByUserId(userId, await bcrypt.hash(newPassword, SALT_ROUNDS));
        return { message: 'Senha atualizada.' };
    },

    forgotPassword: async (email) => {
        const normalizedEmail = validation.email(email);
        if (!process.env.SMTP_HOST || !process.env.FRONTEND_URL || !process.env.JWT_SECRET) validation.fail('Recuperação de acesso indisponível no momento.', 503);

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
                console.error('Falha no envio de recuperação.');
                validation.fail('Não foi possível enviar as instruções de recuperação.', 503);
            }
        }

        return { message: 'If the email is registered, a recovery link has been sent.' };
    },

    resetPassword: async ({ token, newPassword }) => {
        if (!process.env.JWT_SECRET) validation.fail('Recuperação de acesso indisponível.', 503);
        if (!token || !newPassword) {
            throw { status: 400, message: 'Token and newPassword are required.' };
        }

        validation.password(newPassword);

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

module.exports = userService;
