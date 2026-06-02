const crypto = require('crypto');
const db = require('../config/db');

const tokenTtlHours = 12;

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `pbkdf2_sha512$120000$${salt}$${hash}`;
};

const verifyPassword = (password, storedHash) => {
  if (!password || !storedHash) return false;

  const [algorithm, iterations, salt, hash] = storedHash.split('$');
  if (algorithm !== 'pbkdf2_sha512' || !iterations || !salt || !hash) return false;

  const candidate = crypto
    .pbkdf2Sync(password, salt, Number(iterations), 64, 'sha512')
    .toString('hex');

  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
};

const ensureAdminSchema = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS AdminUsers (
      AdminUserID BIGINT PRIMARY KEY AUTO_INCREMENT,
      FullName VARCHAR(150) NOT NULL,
      EmailID VARCHAR(150) NOT NULL UNIQUE,
      PasswordHash VARCHAR(255) NOT NULL,
      RoleCode VARCHAR(30) NOT NULL DEFAULT 'SUPER_ADMIN',
      IsActive TINYINT(1) NOT NULL DEFAULT 1,
      CreatedOn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UpdatedOn DATETIME NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS AdminSessions (
      AdminSessionID BIGINT PRIMARY KEY AUTO_INCREMENT,
      AdminUserID BIGINT NOT NULL,
      TokenHash VARCHAR(128) NOT NULL UNIQUE,
      ExpiresOn DATETIME NOT NULL,
      IsActive TINYINT(1) NOT NULL DEFAULT 1,
      CreatedOn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      LastSeenOn DATETIME NULL,
      FOREIGN KEY (AdminUserID) REFERENCES AdminUsers(AdminUserID)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS AdminAuditLog (
      AdminAuditLogID BIGINT PRIMARY KEY AUTO_INCREMENT,
      AdminUserID BIGINT NULL,
      Action VARCHAR(100) NOT NULL,
      EntityType VARCHAR(100) NULL,
      EntityID VARCHAR(100) NULL,
      OldValue JSON NULL,
      NewValue JSON NULL,
      IpAddress VARCHAR(45) NULL,
      CreatedOn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_admin_audit_entity (EntityType, EntityID),
      KEY idx_admin_audit_admin (AdminUserID)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS AdminAppPages (
      AppPageID BIGINT PRIMARY KEY AUTO_INCREMENT,
      PageCode VARCHAR(80) NOT NULL UNIQUE,
      PageName VARCHAR(150) NOT NULL,
      Description VARCHAR(500) NULL,
      AppRouteKey VARCHAR(150) NULL,
      IsActive TINYINT(1) NOT NULL DEFAULT 1,
      SortOrder INT NOT NULL DEFAULT 0,
      CreatedOn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UpdatedOn DATETIME NULL
    )
  `);

  await seedAdminAppPages();

  const adminEmail = process.env.SUPER_ADMIN_EMAIL;
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const [rows] = await db.query('SELECT AdminUserID FROM AdminUsers WHERE EmailID = ? LIMIT 1', [
      adminEmail,
    ]);

    if (rows.length === 0) {
      await db.query(
        `
        INSERT INTO AdminUsers (FullName, EmailID, PasswordHash, RoleCode)
        VALUES (?, ?, ?, 'SUPER_ADMIN')
        `,
        ['Super Admin', adminEmail, hashPassword(adminPassword)]
      );
    }
  }
};

const seedAdminAppPages = async () => {
  const pages = [
    ['MANAGE_PATRON', 'Manage Patron', 'View, edit, and delete patron profiles', 'ManagePatron'],
    ['MANAGE_CARETAKER', 'Manage Caretaker', 'View, edit, and delete caretakers', 'ManageCaretaker'],
    ['DAILY_ACTIVITY', 'Daily Activity', 'View, edit, and delete daily activity records', 'DailyActivity'],
    ['DOCTOR_APPOINTMENT', 'Doctor Appointment', 'View, edit, and delete doctor appointments', 'DoctorAppointment'],
    ['SCHEDULE_MEDICINE', 'Schedule Medicine', 'View, edit, and delete medicine schedule data', 'ScheduleMedicine'],
    ['VITALS', 'Vitals', 'View, edit, and delete vitals records', 'Vitals'],
    ['PAYMENTS', 'Payments', 'View payment transaction status and failure details', 'Payments'],
    ['PLAN_MANAGEMENT', 'Plan Management', 'Manage plan pricing and limits', 'Plans'],
  ];

  for (let index = 0; index < pages.length; index += 1) {
    const [pageCode, pageName, description, appRouteKey] = pages[index];
    await db.query(
      `
      INSERT INTO AdminAppPages (PageCode, PageName, Description, AppRouteKey, SortOrder)
      SELECT ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM AdminAppPages WHERE PageCode = ?
      )
      `,
      [pageCode, pageName, description, appRouteKey, index + 1, pageCode]
    );
  }
};

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createSession = async (adminUserId) => {
  await ensureAdminSchema();

  const token = crypto.randomBytes(48).toString('hex');
  await db.query(
    `
    INSERT INTO AdminSessions (AdminUserID, TokenHash, ExpiresOn)
    VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))
    `,
    [adminUserId, tokenHash(token), tokenTtlHours]
  );

  return token;
};

const findAdminByEmail = async (emailId) => {
  await ensureAdminSchema();

  const [rows] = await db.query(
    `
    SELECT *
    FROM AdminUsers
    WHERE EmailID = ?
      AND IsActive = 1
    LIMIT 1
    `,
    [emailId]
  );

  return rows[0] || null;
};

const findAdminByToken = async (token) => {
  await ensureAdminSchema();

  const [rows] = await db.query(
    `
    SELECT AU.AdminUserID, AU.FullName, AU.EmailID, AU.RoleCode
    FROM AdminSessions S
    INNER JOIN AdminUsers AU ON AU.AdminUserID = S.AdminUserID
    WHERE S.TokenHash = ?
      AND S.IsActive = 1
      AND S.ExpiresOn > NOW()
      AND AU.IsActive = 1
    LIMIT 1
    `,
    [tokenHash(token)]
  );

  if (rows[0]) {
    await db.query('UPDATE AdminSessions SET LastSeenOn = NOW() WHERE TokenHash = ?', [
      tokenHash(token),
    ]);
  }

  return rows[0] || null;
};

const logout = async (token) => {
  await ensureAdminSchema();
  await db.query('UPDATE AdminSessions SET IsActive = 0 WHERE TokenHash = ?', [tokenHash(token)]);
};

const audit = async ({ adminUserId, action, entityType, entityId, oldValue, newValue, ipAddress }) => {
  await ensureAdminSchema();

  await db.query(
    `
    INSERT INTO AdminAuditLog (
      AdminUserID, Action, EntityType, EntityID, OldValue, NewValue, IpAddress
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      adminUserId || null,
      action,
      entityType || null,
      entityId == null ? null : String(entityId),
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ipAddress || null,
    ]
  );
};

const paginate = (query) => {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 25), 1), 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
};

const listWithCount = async ({ selectSql, countSql, params, query }) => {
  const { page, pageSize, offset } = paginate(query);
  const [rows] = await db.query(`${selectSql} LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  const [countRows] = await db.query(countSql, params);

  return {
    data: rows,
    pagination: {
      page,
      pageSize,
      totalCount: countRows[0]?.TotalCount || 0,
      totalPages: Math.ceil((countRows[0]?.TotalCount || 0) / pageSize),
    },
  };
};

const getDashboard = async () => {
  await ensureAdminSchema();

  const [[users], [payments], [plans], [activities]] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) AS totalUsers,
        SUM(USM.StatusCode = 'ACTV') AS activeUsers,
        SUM(USM.StatusCode = 'BLCK') AS blockedUsers,
        SUM(USM.StatusCode = 'DELT') AS deletedUsers
      FROM UserMaster U
      LEFT JOIN UserStatusMaster USM ON USM.StatusID = U.StatusID
    `),
    db.query(`
      SELECT
        COUNT(*) AS totalPayments,
        SUM(Status = 'CREATED') AS createdPayments,
        SUM(Status = 'VERIFIED') AS verifiedPayments,
        SUM(Status = 'USED') AS usedPayments,
        SUM(Status = 'FAILED') AS failedPayments
      FROM PaymentTransaction
    `),
    db.query('SELECT COUNT(*) AS totalPlans, SUM(IsActive = 1) AS activePlans FROM PlanMaster'),
    db.query(`
      SELECT
        (SELECT COUNT(*) FROM DailyActivity) AS dailyActivities,
        (SELECT COUNT(*) FROM DoctorAppointment) AS appointments,
        (SELECT COUNT(*) FROM MedicineMaster WHERE IsDeleted = 0) AS medicines,
        (SELECT COUNT(*) FROM Vitals) AS vitals
    `),
  ]);

  return {
    users: users[0],
    payments: payments[0],
    plans: plans[0],
    records: activities[0],
  };
};

const getStatusId = async (statusCode) => {
  const [rows] = await db.query(
    'SELECT StatusID FROM UserStatusMaster WHERE StatusCode = ? LIMIT 1',
    [statusCode]
  );
  return rows[0]?.StatusID || null;
};

const getUserById = async (userId) => {
  const [rows] = await db.query('SELECT * FROM UserMaster WHERE UserID = ? LIMIT 1', [userId]);
  return rows[0] || null;
};

const listUsers = async (query) => {
  const search = `%${query.search || ''}%`;
  const params = [search, search, search];
  const roleFilter = query.roleCode ? ' AND RM.RoleCode = ?' : '';
  if (query.roleCode) params.push(query.roleCode);

  return listWithCount({
    query,
    params,
    selectSql: `
      SELECT
        U.UserID, U.FirstName, U.LastName, U.MobileNumber, U.EmailID, U.DOB,
        U.GenderID, G.GenderName, U.MemberGroupID, U.CreatedOn,
        USM.StatusCode, USM.StatusName,
        RM.RoleCode, RM.RoleName,
        PM.PlanID, PM.PlanName, PM.PlanCode
      FROM UserMaster U
      LEFT JOIN GenderMaster G ON G.GenderID = U.GenderID
      LEFT JOIN UserStatusMaster USM ON USM.StatusID = U.StatusID
      LEFT JOIN UserRoleMapping URM ON URM.UserID = U.UserID AND URM.IsActive = 1
      LEFT JOIN RoleMaster RM ON RM.RoleID = URM.RoleID
      LEFT JOIN MemberGroupMaster MGM ON MGM.MemberGroupID = U.MemberGroupID
      LEFT JOIN PlanMaster PM ON PM.PlanID = MGM.PlanID
      WHERE (U.FirstName LIKE ? OR U.LastName LIKE ? OR U.MobileNumber LIKE ?)
      ${roleFilter}
      ORDER BY U.UserID DESC
    `,
    countSql: `
      SELECT COUNT(DISTINCT U.UserID) AS TotalCount
      FROM UserMaster U
      LEFT JOIN UserRoleMapping URM ON URM.UserID = U.UserID AND URM.IsActive = 1
      LEFT JOIN RoleMaster RM ON RM.RoleID = URM.RoleID
      WHERE (U.FirstName LIKE ? OR U.LastName LIKE ? OR U.MobileNumber LIKE ?)
      ${roleFilter}
    `,
  });
};

const updateUser = async (userId, data, adminUserId) => {
  const allowed = ['FirstName', 'LastName', 'MobileNumber', 'EmailID', 'GenderID', 'DOB'];
  const oldValue = await getUserById(userId);
  const entries = allowed.filter((field) => Object.prototype.hasOwnProperty.call(data, field));
  if (entries.length === 0) return oldValue;

  await db.query(
    `
    UPDATE UserMaster
    SET ${entries.map((field) => `${field} = ?`).join(', ')},
        UpdatedBy = ?,
        UpdatedOn = NOW()
    WHERE UserID = ?
    `,
    [...entries.map((field) => data[field] || null), adminUserId, userId]
  );

  return { oldValue, newValue: await getUserById(userId) };
};

const setUserStatus = async (userId, statusCode, adminUserId) => {
  const statusId = await getStatusId(statusCode);
  if (!statusId) throw new Error(`User status ${statusCode} not found`);

  const oldValue = await getUserById(userId);
  await db.query(
    `
    UPDATE UserMaster
    SET StatusID = ?,
        UpdatedBy = ?,
        UpdatedOn = NOW()
    WHERE UserID = ?
    `,
    [statusId, adminUserId, userId]
  );

  return { oldValue, newValue: await getUserById(userId) };
};

const listPlans = async () => {
  const [rows] = await db.query(`
    SELECT
      PlanID, PlanCode, PlanName, TargetUser, MonthlyPrice, YearlyPrice,
      MaxPTProfiles, MaxCaretakers, MaxMobileLogins,
      IsKYCRequired + 0 AS IsKYCRequired,
      IsActive + 0 AS IsActive,
      CreatedDate, ModifiedDate
    FROM PlanMaster
    ORDER BY PlanID
  `);
  return rows;
};

const updatePlan = async (planId, data) => {
  const oldRows = await listPlans();
  const oldValue = oldRows.find((plan) => Number(plan.PlanID) === Number(planId));
  const allowed = [
    'PlanName',
    'TargetUser',
    'MonthlyPrice',
    'YearlyPrice',
    'MaxPTProfiles',
    'MaxCaretakers',
    'MaxMobileLogins',
    'IsKYCRequired',
    'IsActive',
  ];
  const entries = allowed.filter((field) => Object.prototype.hasOwnProperty.call(data, field));
  if (entries.length === 0) return { oldValue, newValue: oldValue };

  await db.query(
    `
    UPDATE PlanMaster
    SET ${entries.map((field) => `${field} = ?`).join(', ')},
        ModifiedDate = NOW()
    WHERE PlanID = ?
    `,
    [...entries.map((field) => data[field]), planId]
  );

  const newRows = await listPlans();
  return { oldValue, newValue: newRows.find((plan) => Number(plan.PlanID) === Number(planId)) };
};

const listPayments = async (query) => {
  const params = [];
  let where = 'WHERE 1 = 1';

  if (query.status) {
    where += ' AND PT.Status = ?';
    params.push(query.status);
  }

  if (query.search) {
    where += ' AND (PT.ProviderOrderID LIKE ? OR PT.ProviderPaymentID LIKE ? OR PT.MobileNumber LIKE ? OR PT.EmailID LIKE ?)';
    const search = `%${query.search}%`;
    params.push(search, search, search, search);
  }

  return listWithCount({
    query,
    params,
    selectSql: `
      SELECT PT.*, PM.PlanName, PM.PlanCode
      FROM PaymentTransaction PT
      LEFT JOIN PlanMaster PM ON PM.PlanID = PT.PlanID
      ${where}
      ORDER BY PT.PaymentTransactionID DESC
    `,
    countSql: `
      SELECT COUNT(*) AS TotalCount
      FROM PaymentTransaction PT
      ${where}
    `,
  });
};

const roleUsers = (roleCode, query) => listUsers({ ...query, roleCode });

const listDailyActivities = async (query) =>
  listWithCount({
    query,
    params: [],
    selectSql: `
      SELECT DA.*, ACM.CategoryName, U.FirstName, U.LastName, U.MobileNumber
      FROM DailyActivity DA
      LEFT JOIN ActivityCategoryMaster ACM ON ACM.CategoryId = DA.CategoryId
      LEFT JOIN UserMaster U ON U.UserID = DA.UserId
      ORDER BY DA.DailyActivityId DESC
    `,
    countSql: 'SELECT COUNT(*) AS TotalCount FROM DailyActivity',
  });

const updateDailyActivity = async (id, data) => {
  const allowed = ['UserId', 'ActivityDate', 'ActivityTime', 'CategoryId', 'ActivityDescription', 'IsNotified'];
  const entries = allowed.filter((field) => Object.prototype.hasOwnProperty.call(data, field));
  if (entries.length === 0) return;
  await db.query(
    `UPDATE DailyActivity SET ${entries.map((field) => `${field} = ?`).join(', ')} WHERE DailyActivityId = ?`,
    [...entries.map((field) => data[field]), id]
  );
};

const deleteDailyActivity = async (id) => {
  await db.query('DELETE FROM DailyActivity WHERE DailyActivityId = ?', [id]);
};

const listAppointments = async (query) =>
  listWithCount({
    query,
    params: [],
    selectSql: `
      SELECT DA.*, ASM.StatusName, U.FirstName, U.LastName, U.MobileNumber
      FROM DoctorAppointment DA
      LEFT JOIN AppointmentStatusMaster ASM ON ASM.StatusId = DA.StatusId
      LEFT JOIN UserMaster U ON U.UserID = DA.PatronId
      ORDER BY DA.DoctorAppointmentId DESC
    `,
    countSql: 'SELECT COUNT(*) AS TotalCount FROM DoctorAppointment',
  });

const updateAppointment = async (id, data) => {
  const allowed = [
    'PatronId',
    'AppointmentDate',
    'AppointmentTime',
    'DoctorName',
    'Specialist',
    'HospitalName',
    'Address',
    'PhoneNumber',
    'AppointmentDescription',
    'Feedback',
    'StatusId',
  ];
  const entries = allowed.filter((field) => Object.prototype.hasOwnProperty.call(data, field));
  if (entries.length === 0) return;
  await db.query(
    `UPDATE DoctorAppointment SET ${entries.map((field) => `${field} = ?`).join(', ')} WHERE DoctorAppointmentId = ?`,
    [...entries.map((field) => data[field]), id]
  );
};

const deleteAppointment = async (id) => {
  const [rows] = await db.query(
    "SELECT StatusId FROM AppointmentStatusMaster WHERE StatusName = 'Deleted' LIMIT 1"
  );
  if (rows[0]?.StatusId) {
    await db.query('UPDATE DoctorAppointment SET StatusId = ? WHERE DoctorAppointmentId = ?', [
      rows[0].StatusId,
      id,
    ]);
  } else {
    await db.query('DELETE FROM DoctorAppointment WHERE DoctorAppointmentId = ?', [id]);
  }
};

const listMedicines = async (query) =>
  listWithCount({
    query,
    params: [],
    selectSql: `
      SELECT
        M.MedicineId, M.PatronId, M.MedicineName, M.MedicineTypeId, MT.MedicineTypeName,
        M.FromDate, M.ToDate, M.TimeZone, M.CreatedDate, M.ModifiedDate,
        U.FirstName, U.LastName, U.MobileNumber
      FROM MedicineMaster M
      LEFT JOIN MedicineTypeMaster MT ON MT.MedicineTypeId = M.MedicineTypeId
      LEFT JOIN UserMaster U ON U.UserID = M.PatronId
      WHERE M.IsDeleted = 0
      ORDER BY M.MedicineId DESC
    `,
    countSql: 'SELECT COUNT(*) AS TotalCount FROM MedicineMaster WHERE IsDeleted = 0',
  });

const updateMedicine = async (id, data, adminUserId) => {
  const allowed = ['PatronId', 'MedicineName', 'MedicineTypeId', 'FromDate', 'ToDate', 'TimeZone'];
  const entries = allowed.filter((field) => Object.prototype.hasOwnProperty.call(data, field));
  if (entries.length === 0) return;
  await db.query(
    `
    UPDATE MedicineMaster
    SET ${entries.map((field) => `${field} = ?`).join(', ')},
        ModifiedBy = ?,
        ModifiedDate = NOW()
    WHERE MedicineId = ?
    `,
    [...entries.map((field) => data[field]), adminUserId, id]
  );
};

const deleteMedicine = async (id, adminUserId) => {
  await db.query(
    'UPDATE MedicineMaster SET IsDeleted = 1, ModifiedBy = ?, ModifiedDate = NOW() WHERE MedicineId = ?',
    [adminUserId, id]
  );
  await db.query(
    'UPDATE MedicineSchedule SET IsDeleted = 1, ModifiedBy = ?, ModifiedDate = NOW() WHERE MedicineId = ?',
    [adminUserId, id]
  );
};

const listVitals = async (query) =>
  listWithCount({
    query,
    params: [],
    selectSql: `
      SELECT V.*, U.FirstName, U.LastName, U.MobileNumber
      FROM Vitals V
      LEFT JOIN UserMaster U ON U.UserID = V.PatronId
      ORDER BY V.VitalId DESC
    `,
    countSql: 'SELECT COUNT(*) AS TotalCount FROM Vitals',
  });

const updateVitals = async (id, data) => {
  const allowed = [
    'PatronId',
    'Temperature',
    'SystolicBP',
    'DiastolicBP',
    'Pulse',
    'BloodSugar',
    'OxygenSaturation',
    'HeartRate',
    'RespiratoryRate',
    'RecordedAt',
  ];
  const entries = allowed.filter((field) => Object.prototype.hasOwnProperty.call(data, field));
  if (entries.length === 0) return;
  await db.query(
    `UPDATE Vitals SET ${entries.map((field) => `${field} = ?`).join(', ')} WHERE VitalId = ?`,
    [...entries.map((field) => data[field]), id]
  );
};

const deleteVitals = async (id) => {
  await db.query('DELETE FROM Vitals WHERE VitalId = ?', [id]);
};

const listAuditLogs = async (query) =>
  listWithCount({
    query,
    params: [],
    selectSql: `
      SELECT A.*, AU.FullName, AU.EmailID
      FROM AdminAuditLog A
      LEFT JOIN AdminUsers AU ON AU.AdminUserID = A.AdminUserID
      ORDER BY A.AdminAuditLogID DESC
    `,
    countSql: 'SELECT COUNT(*) AS TotalCount FROM AdminAuditLog',
  });

const listAppPages = async () => {
  await ensureAdminSchema();

  const [rows] = await db.query(`
    SELECT
      AppPageID, PageCode, PageName, Description, AppRouteKey,
      IsActive, SortOrder, CreatedOn, UpdatedOn
    FROM AdminAppPages
    ORDER BY SortOrder ASC, PageName ASC
  `);

  return rows;
};

const updateAppPage = async (appPageId, data) => {
  await ensureAdminSchema();

  const [oldRows] = await db.query('SELECT * FROM AdminAppPages WHERE AppPageID = ? LIMIT 1', [
    appPageId,
  ]);
  const oldValue = oldRows[0] || null;
  const allowed = ['PageName', 'Description', 'AppRouteKey', 'IsActive', 'SortOrder'];
  const entries = allowed.filter((field) => Object.prototype.hasOwnProperty.call(data, field));

  if (entries.length === 0) {
    return { oldValue, newValue: oldValue };
  }

  await db.query(
    `
    UPDATE AdminAppPages
    SET ${entries.map((field) => `${field} = ?`).join(', ')},
        UpdatedOn = NOW()
    WHERE AppPageID = ?
    `,
    [...entries.map((field) => data[field]), appPageId]
  );

  const [newRows] = await db.query('SELECT * FROM AdminAppPages WHERE AppPageID = ? LIMIT 1', [
    appPageId,
  ]);
  return { oldValue, newValue: newRows[0] || null };
};

module.exports = {
  audit,
  createSession,
  deleteAppointment,
  deleteDailyActivity,
  deleteMedicine,
  deleteVitals,
  ensureAdminSchema,
  findAdminByEmail,
  findAdminByToken,
  getDashboard,
  listAppointments,
  listAppPages,
  listAuditLogs,
  listDailyActivities,
  listMedicines,
  listPayments,
  listPlans,
  listUsers,
  listVitals,
  logout,
  roleUsers,
  setUserStatus,
  updateAppointment,
  updateAppPage,
  updateDailyActivity,
  updateMedicine,
  updatePlan,
  updateUser,
  updateVitals,
  verifyPassword,
};
