const service = require('../services/userServices');
const respond = require('./respond');
module.exports = {
    register: (req, res) => respond(res, () => service.register(req.body || {}), 201),
    getProfile: (req, res) => respond(res, () => service.getProfile(req.userId)),
    updateProfile: (req, res) => respond(res, () => service.updateProfile(req.userId, req.body || {})),
    changePassword: (req, res) => respond(res, () => service.changePassword(req.userId, req.body || {})),
    forgotPassword: (req, res) => respond(res, () => service.forgotPassword(req.body?.email)),
    resetPassword: (req, res) => respond(res, () => service.resetPassword(req.body || {})),
};
