const authService = require('../services/authServices');
const respond = require('./respond');
module.exports = { login: (req, res) => respond(res, () => authService.login(req.body || {})) };
