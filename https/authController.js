const authService = require('../services/authServices');

const authController = {
    generateToken: async (req, res) => {
        try {
            const { email } = req.query;
            
            const result = await authService.generateTokenByEmail(email);

            return res.status(200).json(result);
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                error: error.message || 'Internal server error.'
            });
        }
    }
};

module.exports = authController;