const express = require('express');
const router = express.Router();

const caretakerController = require('../controllers/caretaker.controller');
const sessionMiddleware = require('../middlewares/session.middleware');

router.get('/registered', sessionMiddleware, caretakerController.getRegisteredCaretakers);
router.get('/assigned', sessionMiddleware, caretakerController.getAssignedCaretakers);
router.post('/assign', sessionMiddleware, caretakerController.assignCaretaker);
router.post('/rate', sessionMiddleware, caretakerController.rateCaretaker);

module.exports = router;
