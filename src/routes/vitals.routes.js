const express = require('express');
const router = express.Router();
const controller = require('../controllers/vitals.controller');
const auth=require('../middlewares/session.middleware');
const {guard}=require('../middlewares/careAccess.middleware');

router.post('/', auth, guard(r=>r.body.patronId), controller.insertVitals);
router.get('/', auth, guard(r=>r.query.patronId), controller.getVitals);

module.exports = router;
