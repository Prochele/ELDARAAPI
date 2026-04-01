// src/routes/medicine.routes.js

const express = require('express');
const router = express.Router();

const medicineController = require('../controllers/medicine.controller');
const authenticateSession = require('../middlewares/session.middleware');

router.post(
  '/schedule',
  authenticateSession,
  medicineController.addMedicineSchedule
);

module.exports = router;