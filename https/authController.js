const authService = require('../services/authServices');

const handleError = (res, error) => {
    return res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Internal server error.'
    });
};

const authController = {
    generateToken: async (req, res) => {
        try {
            const { email } = req.query;
            
            const result = await authService.generateTokenByEmail(email);

            return res.status(200).json(result);
        } catch (error) {
            return handleError(res, error);
        }
    },
    login: async (req, res) => {
        try {
            const result = await authService.login(req.body || {});

            return res.status(200).json({
                success: true,
                message: 'Login successful.',
                data: result
            });
        } catch (error) {
            return handleError(res, error);
        }
    },
};

module.exports = authController;