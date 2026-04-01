// src/routes/ocr.routes.js

const express = require('express');
const router = express.Router();

const ocrController = require('../controllers/ocr.controller');
const authenticateSession = require('../middlewares/session.middleware');

router.post(
  '/extract',
  authenticateSession,
  ocrController.extractOCR
);

module.exports = router;