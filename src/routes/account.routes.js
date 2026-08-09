const express = require('express');
const router = express.Router();

const accountController = require('../controllers/account.controller');
const sessionMiddleware = require('../middlewares/session.middleware');

router.get('/profile', sessionMiddleware, accountController.getProfile);
router.post('/email', sessionMiddleware, accountController.updateEmail);
router.post('/phone', sessionMiddleware, accountController.updatePhone);
router.post('/plan', sessionMiddleware, accountController.updatePlan);
router.post('/remove', sessionMiddleware, accountController.removeAccount);

module.exports = router;
