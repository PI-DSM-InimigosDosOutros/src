const service = require('../services/workoutServices');
const respond = require('./respond');
module.exports = {
    getWod: (req,res) => respond(res, () => service.getWodForUser(req.userId)),
    createWorkout: (req,res) => respond(res, () => service.createWorkout(req.userId), 201),
    startWorkout: (req,res) => respond(res, () => service.startWorkout(req.userId, req.body || {})),
    updateProgress: (req,res) => respond(res, () => service.updateProgress(req.userId, req.body || {})),
    finishWorkout: (req,res) => respond(res, () => service.finishWorkout(req.userId, req.body || {})),
    history: (req,res) => respond(res, () => service.history(req.userId)),
    progress: (req,res) => respond(res, () => service.progress(req.userId)),
};
