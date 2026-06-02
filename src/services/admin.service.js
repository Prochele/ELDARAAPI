const adminRepository = require('../repositories/admin.repository');

const login = async ({ emailId, password }) => {
  if (!emailId || !password) {
    return {
      success: false,
      message: 'Email and password are required',
    };
  }

  const admin = await adminRepository.findAdminByEmail(emailId);
  if (!admin || !adminRepository.verifyPassword(password, admin.PasswordHash)) {
    return {
      success: false,
      message: 'Invalid admin credentials',
    };
  }

  const token = await adminRepository.createSession(admin.AdminUserID);

  await adminRepository.audit({
    adminUserId: admin.AdminUserID,
    action: 'ADMIN_LOGIN',
    entityType: 'AdminUsers',
    entityId: admin.AdminUserID,
  });

  return {
    success: true,
    message: 'Admin login successful',
    data: {
      token,
      admin: {
        adminUserId: admin.AdminUserID,
        fullName: admin.FullName,
        emailId: admin.EmailID,
        roleCode: admin.RoleCode,
      },
    },
  };
};

const logout = async (token, admin) => {
  await adminRepository.logout(token);
  await adminRepository.audit({
    adminUserId: admin.AdminUserID,
    action: 'ADMIN_LOGOUT',
    entityType: 'AdminUsers',
    entityId: admin.AdminUserID,
  });
};

const auditAction = async (req, action, entityType, entityId, oldValue, newValue) => {
  await adminRepository.audit({
    adminUserId: req.admin?.AdminUserID,
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress: req.ip,
  });
};

module.exports = {
  auditAction,
  getDashboard: adminRepository.getDashboard,
  listAppointments: adminRepository.listAppointments,
  listAppPages: adminRepository.listAppPages,
  listAuditLogs: adminRepository.listAuditLogs,
  listCaretakers: (query) => adminRepository.roleUsers('CT', query),
  listDailyActivities: adminRepository.listDailyActivities,
  listMedicines: adminRepository.listMedicines,
  listPatrons: (query) => adminRepository.roleUsers('PT', query),
  listPayments: adminRepository.listPayments,
  listPlans: adminRepository.listPlans,
  listUsers: adminRepository.listUsers,
  listVitals: adminRepository.listVitals,
  login,
  logout,
  setUserStatus: adminRepository.setUserStatus,
  updateAppointment: adminRepository.updateAppointment,
  updateAppPage: adminRepository.updateAppPage,
  updateDailyActivity: adminRepository.updateDailyActivity,
  updateMedicine: adminRepository.updateMedicine,
  updatePlan: adminRepository.updatePlan,
  updateUser: adminRepository.updateUser,
  updateVitals: adminRepository.updateVitals,
  deleteAppointment: adminRepository.deleteAppointment,
  deleteDailyActivity: adminRepository.deleteDailyActivity,
  deleteMedicine: adminRepository.deleteMedicine,
  deleteVitals: adminRepository.deleteVitals,
};
