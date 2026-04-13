const express = require('express');
const router = express.Router();
const medicineScheduleController = require('../controllers/medicineSchedule.controller');
const authenticateSession = require('../middlewares/session.middleware');

router.get('/get-medicine-schedule/:patronId', authenticateSession, medicineScheduleController.getMedicineSchedule);

router.delete('/delete-medicine/:medicineId', authenticateSession, medicineScheduleController.deleteMedicine);

module.exports = router;