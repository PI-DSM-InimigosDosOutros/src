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
            subject: 'Password recovery',
            text: `Hello, ${firstName}! Use the link below to reset your password (valid for 15 minutes):\n\n${resetLink}\n\nIf you did not request this, just ignore this email.`,
            html: `
                <p>Hello, ${firstName}!</p>
                <p>Click the link below to reset your password (valid for 15 minutes):</p>
                <p><a href="${resetLink}">Reset password</a></p>
                <p>If you did not request this, just ignore this email.</p>
            `
        });
    }
};

module.exports = mailService;