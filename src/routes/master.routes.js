// src/routes/master.routes.js

const express = require('express');
const router = express.Router();

const masterController = require('../controllers/master.controller');
const authenticateSession = require('../middlewares/session.middleware');

router.get('/medicine-types', authenticateSession, masterController.getMedicineTypes);

router.get('/medicine-schedules-types', authenticateSession, masterController.getMedicineSchedulesTypes);

router.get('/intake-types', authenticateSession, masterController.getIntakeTypes);

module.exports = router;