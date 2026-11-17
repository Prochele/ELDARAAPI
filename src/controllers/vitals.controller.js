const service = require('../services/vitals.service');

exports.insertVitals = async (req, res, next) => {
    try {

        const result = await service.insertVitals({...req.body,createdBy:req.user.UserID});

        res.json(result);
    } catch (err) {
        console.error("VITALS ERROR:", err);
        next(err);
    }
};

exports.getVitals = async (req, res, next) => {
    try {
        const result = await service.getVitals(req.query);
        res.json(result);
    } catch (err) {
        next(err);
    }
};
