const service = require('../services/doctorAppointment.service');
const response = require('../utils/response.util');

exports.addDoctorAppointment = async (req, res, next) => {
    try {
        const result = await service.addDoctorAppointment(req.body, req.user);
        return response.successResponse(res, 'Success', result);
    } catch (err) {
        next(err);
    }
};

exports.getDoctorAppointments = async (req, res, next) => {
    try {
        const { patronId } = req.params;
        const result = await service.getDoctorAppointments(patronId);
        return response.successResponse(res, 'Success', result);
    } catch (err) {
        next(err);
    }
};

exports.addFeedback = async (req, res, next) => {
    try {
        const result = await service.addFeedback(req.body);
        return response.successResponse(res, 'Success', result);
    } catch (err) {
        next(err);
    }
};

exports.deleteDoctorAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await service.deleteDoctorAppointment(id);
        return response.successResponse(res, 'Success', result);
    } catch (err) {
        next(err);
    }
};