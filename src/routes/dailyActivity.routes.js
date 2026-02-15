const express = require('express');
const router = express.Router();

const dailyActivityController = require('../controllers/dailyActivity.controller');

const authenticateSession = require('../middlewares/session.middleware');
//const { authenticateSession } = require('../middlewares/session.middleware');


router.post(
  '/add',
  authenticateSession,
  dailyActivityController.addDailyActivity
);

router.get(
  '/list',
  authenticateSession,
  dailyActivityController.getDailyActivities
);

router.post(
  '/delete',
  authenticateSession,
  dailyActivityController.deleteDailyActivity
);

module.exports = router;
