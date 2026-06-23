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

    if (!Feedback || !String(Feedback).trim()) {
        throw new Error('Feedback is required');
    }

    const appointment = await repo.getDoctorAppointmentById(DoctorAppointmentId);

    if (!appointment) {
        throw new Error('Appointment not found');
    }

    const appointmentDate = appointment.AppointmentDate instanceof Date
        ? appointment.AppointmentDate.toISOString().split('T')[0]
        : String(appointment.AppointmentDate).split('T')[0];
    const appointmentDateTime = new Date(`${appointmentDate}T${appointment.AppointmentTime}`);

    if (appointmentDateTime.getTime() > Date.now()) {
        throw new Error('Feedback can be submitted only after the appointment date and time is completed.');
    }

    return await repo.addFeedback(DoctorAppointmentId, Feedback);
};

exports.deleteDoctorAppointment = async (DoctorAppointmentId) => {

    if (!DoctorAppointmentId) {
        throw new Error('DoctorAppointmentId is required');
    }

    return await repo.deleteDoctorAppointment(DoctorAppointmentId);
};
