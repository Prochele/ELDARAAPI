// src/routes/medicine.routes.js

const express = require('express');
const router = express.Router();

const medicineController = require('../controllers/medicine.controller');
const authenticateSession = require('../middlewares/session.middleware');
const {guard,resource}=require('../middlewares/careAccess.middleware');

router.post(
  '/schedule',
  authenticateSession,
  guard(r=>r.body.patronId),
  medicineController.addMedicineSchedule
);

router.post(
  '/log-status',
  authenticateSession,
  guard(resource('MedicineSchedule','ScheduleId',r=>r.body.scheduleId)),
  medicineController.logMedicineStatus
);
module.exports = router;
