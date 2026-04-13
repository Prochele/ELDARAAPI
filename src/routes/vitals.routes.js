const express = require('express');
const router = express.Router();
const controller = require('../controllers/vitals.controller');

router.post('/', controller.insertVitals);
router.get('/', controller.getVitals);

module.exports = router;