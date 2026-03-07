const express = require('express');
const router = express.Router();
const geoController = require('../controllers/geo.controller');

router.get('/hierarchy', geoController.getGeoHierarchy);

router.post('/country-code', geoController.getCountryCode);

module.exports = router;