const express = require('express');
const router = express.Router();
const geoController = require('../controllers/geo.controller');

router.get('/hierarchy', geoController.getGeoHierarchy);

module.exports = router;