const service = require('../services/vitals.service');

exports.insertVitals = async (req, res, next) => {
    try {
        const result = await service.insertVitals(req.body);
        res.json(result);
    } catch (err) {
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