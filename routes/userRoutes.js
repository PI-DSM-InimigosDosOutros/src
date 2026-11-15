const express = require('express');
const router = express.Router();
const userController = require('../https/userController');
const auth = require('../middlewares/authMiddleware');

router.post('/user/register', userController.register);
router.post('/user/forgot-password', userController.forgotPassword);
router.post('/user/reset-password', userController.resetPassword);
router.get('/user/profile', auth, userController.getProfile);
router.put('/user/profile', auth, userController.updateProfile);
router.post('/user/change-password', auth, userController.changePassword);

module.exports = router;
