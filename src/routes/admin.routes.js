const express = require('express');
const adminController = require('../controllers/admin.controller');
const authenticateAdmin = require('../middlewares/admin.middleware');

const router = express.Router();

router.post('/auth/login', adminController.login);

router.use(authenticateAdmin);

router.post('/auth/logout', adminController.logout);
router.get('/auth/me', adminController.me);
router.get('/dashboard', adminController.dashboard);

router.get('/users', adminController.listUsers);
router.put('/users/:userId', adminController.updateUser);
router.patch('/users/:userId/block', adminController.blockUser);
router.patch('/users/:userId/unblock', adminController.unblockUser);
router.delete('/users/:userId', adminController.deleteUser);

router.get('/patrons', adminController.listPatrons);
router.put('/patrons/:userId', adminController.updateUser);
router.patch('/patrons/:userId/block', adminController.blockUser);
router.patch('/patrons/:userId/unblock', adminController.unblockUser);
router.delete('/patrons/:userId', adminController.deleteUser);

router.get('/caretakers', adminController.listCaretakers);
router.put('/caretakers/:userId', adminController.updateUser);
router.patch('/caretakers/:userId/block', adminController.blockUser);
router.patch('/caretakers/:userId/unblock', adminController.unblockUser);
router.delete('/caretakers/:userId', adminController.deleteUser);

router.get('/plans', adminController.listPlans);
router.put('/plans/:planId', adminController.updatePlan);

router.get('/app-pages', adminController.listAppPages);
router.put('/app-pages/:appPageId', adminController.updateAppPage);

router.get('/payments', adminController.listPayments);

router.get('/daily-activities', adminController.listDailyActivities);
router.put('/daily-activities/:dailyActivityId', adminController.updateDailyActivity);
router.delete('/daily-activities/:dailyActivityId', adminController.deleteDailyActivity);

router.get('/appointments', adminController.listAppointments);
router.put('/appointments/:appointmentId', adminController.updateAppointment);
router.delete('/appointments/:appointmentId', adminController.deleteAppointment);

router.get('/medicines', adminController.listMedicines);
router.put('/medicines/:medicineId', adminController.updateMedicine);
router.delete('/medicines/:medicineId', adminController.deleteMedicine);

router.get('/vitals', adminController.listVitals);
router.put('/vitals/:vitalId', adminController.updateVitals);
router.delete('/vitals/:vitalId', adminController.deleteVitals);

router.get('/audit-logs', adminController.listAuditLogs);

module.exports = router;
