const express = require('express');
const router = express.Router();

const deviceController = require('../controllers/device.controller');
const authenticateSession = require('../middlewares/session.middleware');

router.post(
  '/token',
  authenticateSession,
  deviceController.saveDeviceToken
);

router.get(
  '/medicine-reminder-notifications',
  authenticateSession,
  deviceController.getMedicineReminderNotifications
);

router.put(
  '/medicine-reminder-notifications',
  authenticateSession,
  deviceController.updateMedicineReminderNotifications
);

module.exports = router;
