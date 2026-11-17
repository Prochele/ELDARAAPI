const express = require('express');
const router = express.Router();
const medicineScheduleController = require('../controllers/medicineSchedule.controller');
const authenticateSession = require('../middlewares/session.middleware');
const {guard,resource}=require('../middlewares/careAccess.middleware');

router.get('/get-medicine-schedule/:patronId', authenticateSession, guard(r=>r.params.patronId), medicineScheduleController.getMedicineSchedule);

router.delete('/delete-medicine/:medicineId', authenticateSession, guard(resource('MedicineMaster','MedicineId',r=>r.params.medicineId)), medicineScheduleController.deleteMedicine);

module.exports = router;
