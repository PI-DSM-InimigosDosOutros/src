const userRepository = require('../repositories/userRepository');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;

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
    }
};

module.exports = authService;