const db = require('../config/db');

exports.addDoctorAppointment = async (data) => {
    const {
        PatronId,
        AppointmentDate,
        AppointmentTime,
        DoctorName,
        Specialist,
        HospitalName,
        Address,
        PhoneNumber,
        AppointmentDescription,
        CreatedBy
    } = data;

    const [rows] = await db.query(
        `CALL USP_AddDoctorAppointment(?,?,?,?,?,?,?,?,?,?)`,
        [
            PatronId,
            AppointmentDate,
            AppointmentTime,
            DoctorName,
            Specialist,
            HospitalName,
            Address,
            PhoneNumber,
            AppointmentDescription,
            CreatedBy
        ]
    );

    return rows[0][0];
};

exports.getDoctorAppointments = async (PatronId) => {
    const [rows] = await db.query(
        `CALL USP_GetDoctorAppointments(?)`,
        [PatronId]
    );

    return rows[0];
};

exports.addFeedback = async (DoctorAppointmentId, Feedback) => {
    const [rows] = await db.query(
        `CALL USP_AddDoctorAppointmentFeedback(?,?)`,
        [DoctorAppointmentId, Feedback]
    );

    return rows[0][0];
};

exports.deleteDoctorAppointment = async (DoctorAppointmentId) => {
    const [rows] = await db.query(
        `CALL USP_DeleteDoctorAppointment(?)`,
        [DoctorAppointmentId]
    );

    return rows[0][0];
};