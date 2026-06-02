const adminService = require('../services/admin.service');

const sendResult = (res, result, successMessage = 'Success') => {
  if (result && Object.prototype.hasOwnProperty.call(result, 'success')) {
    return res.status(result.success ? 200 : 400).json(result);
  }

  return res.status(200).json({
    success: true,
    message: successMessage,
    data: result || null,
  });
};

const login = async (req, res, next) => {
  try {
    return sendResult(res, await adminService.login(req.body || {}));
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await adminService.logout(req.adminToken, req.admin);
    return sendResult(res, null, 'Admin logout successful');
  } catch (error) {
    next(error);
  }
};

const me = async (req, res) =>
  sendResult(
    res,
    {
      adminUserId: req.admin.AdminUserID,
      fullName: req.admin.FullName,
      emailId: req.admin.EmailID,
      roleCode: req.admin.RoleCode,
    },
    'Admin profile fetched'
  );

const dashboard = async (req, res, next) => {
  try {
    return sendResult(res, await adminService.getDashboard(), 'Dashboard fetched');
  } catch (error) {
    next(error);
  }
};

const list = (serviceMethod, message) => async (req, res, next) => {
  try {
    return sendResult(res, await serviceMethod(req.query || {}), message);
  } catch (error) {
    next(error);
  }
};

const update = (serviceMethod, entityType, idParam, action) => async (req, res, next) => {
  try {
    const result = await serviceMethod(req.params[idParam], req.body || {}, req.admin.AdminUserID);
    await adminService.auditAction(
      req,
      action,
      entityType,
      req.params[idParam],
      result?.oldValue,
      result?.newValue || req.body
    );
    return sendResult(res, result?.newValue || null, `${entityType} updated`);
  } catch (error) {
    next(error);
  }
};

const remove = (serviceMethod, entityType, idParam, action) => async (req, res, next) => {
  try {
    await serviceMethod(req.params[idParam], req.admin.AdminUserID);
    await adminService.auditAction(req, action, entityType, req.params[idParam], null, null);
    return sendResult(res, null, `${entityType} deleted`);
  } catch (error) {
    next(error);
  }
};

const setUserStatus = (statusCode, action, message) => async (req, res, next) => {
  try {
    const result = await adminService.setUserStatus(
      req.params.userId,
      statusCode,
      req.admin.AdminUserID
    );
    await adminService.auditAction(
      req,
      action,
      'UserMaster',
      req.params.userId,
      result.oldValue,
      result.newValue
    );
    return sendResult(res, result.newValue, message);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  blockUser: setUserStatus('BLCK', 'USER_BLOCKED', 'User blocked'),
  dashboard,
  deleteAppointment: remove(
    adminService.deleteAppointment,
    'DoctorAppointment',
    'appointmentId',
    'APPOINTMENT_DELETED'
  ),
  deleteDailyActivity: remove(
    adminService.deleteDailyActivity,
    'DailyActivity',
    'dailyActivityId',
    'DAILY_ACTIVITY_DELETED'
  ),
  deleteMedicine: remove(adminService.deleteMedicine, 'MedicineMaster', 'medicineId', 'MEDICINE_DELETED'),
  deleteUser: setUserStatus('DELT', 'USER_DELETED', 'User deleted'),
  deleteVitals: remove(adminService.deleteVitals, 'Vitals', 'vitalId', 'VITALS_DELETED'),
  listAppointments: list(adminService.listAppointments, 'Appointments fetched'),
  listAppPages: async (req, res, next) => {
    try {
      return sendResult(res, await adminService.listAppPages(), 'App pages fetched');
    } catch (error) {
      next(error);
    }
  },
  listAuditLogs: list(adminService.listAuditLogs, 'Audit logs fetched'),
  listCaretakers: list(adminService.listCaretakers, 'Caretakers fetched'),
  listDailyActivities: list(adminService.listDailyActivities, 'Daily activities fetched'),
  listMedicines: list(adminService.listMedicines, 'Medicines fetched'),
  listPatrons: list(adminService.listPatrons, 'Patrons fetched'),
  listPayments: list(adminService.listPayments, 'Payments fetched'),
  listPlans: async (req, res, next) => {
    try {
      return sendResult(res, await adminService.listPlans(), 'Plans fetched');
    } catch (error) {
      next(error);
    }
  },
  listUsers: list(adminService.listUsers, 'Users fetched'),
  listVitals: list(adminService.listVitals, 'Vitals fetched'),
  login,
  logout,
  me,
  unblockUser: setUserStatus('ACTV', 'USER_UNBLOCKED', 'User unblocked'),
  updateAppointment: update(
    adminService.updateAppointment,
    'DoctorAppointment',
    'appointmentId',
    'APPOINTMENT_UPDATED'
  ),
  updateAppPage: update(adminService.updateAppPage, 'AdminAppPages', 'appPageId', 'APP_PAGE_UPDATED'),
  updateDailyActivity: update(
    adminService.updateDailyActivity,
    'DailyActivity',
    'dailyActivityId',
    'DAILY_ACTIVITY_UPDATED'
  ),
  updateMedicine: update(adminService.updateMedicine, 'MedicineMaster', 'medicineId', 'MEDICINE_UPDATED'),
  updatePlan: update(adminService.updatePlan, 'PlanMaster', 'planId', 'PLAN_UPDATED'),
  updateUser: update(adminService.updateUser, 'UserMaster', 'userId', 'USER_UPDATED'),
  updateVitals: update(adminService.updateVitals, 'Vitals', 'vitalId', 'VITALS_UPDATED'),
};
