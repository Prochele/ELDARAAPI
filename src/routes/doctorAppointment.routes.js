const express = require('express');
const router = express.Router();
const controller = require('../controllers/doctorAppointment.controller');
const auth = require('../middlewares/session.middleware');
const {guard,resource}=require('../middlewares/careAccess.middleware');

// Add Appointment
router.post('/', auth, guard(r=>r.body.PatronId), controller.addDoctorAppointment);

// List
router.get('/:patronId', auth, guard(r=>r.params.patronId), controller.getDoctorAppointments);

// Feedback
router.put('/feedback', auth, guard(resource('DoctorAppointment','DoctorAppointmentId',r=>r.body.DoctorAppointmentId)), controller.addFeedback);

// Delete
router.delete('/:id', auth, guard(resource('DoctorAppointment','DoctorAppointmentId',r=>r.params.id)), controller.deleteDoctorAppointment);

module.exports = router;
