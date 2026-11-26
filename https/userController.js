const userService = require('../services/userServices');

const handleError = (res, error) => {
    return res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Internal server error.'
    });
};

const userController = {
    register: async (req, res) => {
        try {
            const result = await userService.register(req.body || {});

            return res.status(201).json({
                success: true,
                message: 'User registered successfully.',
                data: result
            });
        } catch (error) {
            return handleError(res, error);
        }
    },

    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body || {};
            const result = await userService.forgotPassword(email);

            return res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            return handleError(res, error);
        }
    },

    resetPassword: async (req, res) => {
        try {
            const result = await userService.resetPassword(req.body || {});

            return res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            return handleError(res, error);
        }
    }
}

module.exports = userController;