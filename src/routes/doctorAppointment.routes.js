const express = require('express');
const router = express.Router();
const controller = require('../controllers/doctorAppointment.controller');
const auth = require('../middlewares/session.middleware');

// Add Appointment
router.post('/', auth, controller.addDoctorAppointment);

// List
router.get('/:patronId', auth, controller.getDoctorAppointments);

// Feedback
router.put('/feedback', auth, controller.addFeedback);

// Delete
router.delete('/:id', auth, controller.deleteDoctorAppointment);

module.exports = router;