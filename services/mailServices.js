const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const mailService = {
    sendPasswordResetEmail: async (to, firstName, resetLink) => {
        if (!process.env.SMTP_HOST) {
            console.log(`[DEV] Password reset link for ${to}: ${resetLink}`);
            return;
        }

        await transporter.sendMail({
            from: process.env.MAIL_FROM,
            to,
            subject: 'Redefinição de Senha',
            text: `Olá, ${firstName}! Use o link abaixo para redefinir sua senha (válido por 15 minutos):\n\n${resetLink}\n\nIf you did not request this, just ignore this email.`,
            html: `
                <p>Olá, ${firstName}!</p>
                <p>Clique no link abaixo para redefinir sua senha (válido por 15 minutos):</p>
                <p><a href="${resetLink}">Redefinir senha</a></p>
                <p>Se você não solicitou isso, apenas ignore este email.</p>
            `
        });
    }
};

module.exports = mailService;