const express = require('express');
const planController = require('../controllers/plan.controller');

const router = express.Router();

router.get('/', planController.listPlans);

module.exports = router;
