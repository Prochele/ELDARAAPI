const repo = require('../repositories/doctorAppointment.repository');

exports.addDoctorAppointment = async (body, user) => {

    if (!body.PatronId) {
        throw new Error('PatronId is required');
    }

    body.CreatedBy = user.UserID;

    return await repo.addDoctorAppointment(body);
};

exports.getDoctorAppointments = async (PatronId) => {

    if (!PatronId) {
        throw new Error('PatronId is required');
    }

    return await repo.getDoctorAppointments(PatronId);
};

exports.addFeedback = async (body) => {

    const { DoctorAppointmentId, Feedback } = body;

    if (!DoctorAppointmentId) {
        throw new Error('DoctorAppointmentId is required');
    }

    return await repo.addFeedback(DoctorAppointmentId, Feedback);
};

exports.deleteDoctorAppointment = async (DoctorAppointmentId) => {

    if (!DoctorAppointmentId) {
        throw new Error('DoctorAppointmentId is required');
    }

    return await repo.deleteDoctorAppointment(DoctorAppointmentId);
};