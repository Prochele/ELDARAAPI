const express = require('express');
const router = express.Router();

const deviceController = require('../controllers/device.controller');
const authenticateSession = require('../middlewares/session.middleware');

router.post(
  '/token',
  authenticateSession,
  deviceController.saveDeviceToken
);

module.exports = router;