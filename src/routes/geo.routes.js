const express = require('express');
const router = express.Router();
const geoController = require('../controllers/geo.controller');

router.get('/hierarchy', geoController.getGeoHierarchy);
router.get('/countries', geoController.getCountries);
router.get('/provinces', geoController.getProvinces);
router.get('/districts', geoController.getDistricts);
router.get('/cities', geoController.getCities);
router.get('/areas', geoController.getAreas);

router.post('/country-code', geoController.getCountryCode);

module.exports = router;
