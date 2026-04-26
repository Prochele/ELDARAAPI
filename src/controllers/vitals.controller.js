const service = require('../services/vitals.service');

exports.insertVitals = async (req, res, next) => {
    try {

        console.log("VITALS API HIT:", req.body); 

        const result = await service.insertVitals(req.body);

        console.log("VITALS SUCCESS:", result);

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