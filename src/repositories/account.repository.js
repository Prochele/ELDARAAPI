const db = require('../config/db');

const getProfile = async (userId) => {
  const [rows] = await db.query(
    `
    SELECT
      U.UserID AS userId,
      U.FirstName AS firstName,
      U.LastName AS lastName,
      CONCAT_WS(' ', U.FirstName, U.LastName) AS userName,
      U.MobileNumber AS mobileNumber,
      U.EmailID AS emailId,
      U.DOB AS dob,
      G.GenderName AS genderName,
      CASE
        WHEN RM.RoleCode = 'PTA' AND PM.PlanCode = 'BASIC' THEN 'PTASelf'
        WHEN RM.RoleCode = 'PTA' AND PM.PlanCode = 'PREMIUM' THEN 'PTAFamily'
        ELSE RM.RoleCode
      END AS roleCode,
      RM.RoleName AS roleName,
      PM.PlanCode AS planCode,
      PM.PlanName AS planName,
      USM.StatusName AS statusName,
      U.MemberGroupID AS memberGroupId,
      U.CreatedOn AS createdOn
    FROM UserMaster U
    LEFT JOIN GenderMaster G
      ON G.GenderID = U.GenderID
    LEFT JOIN UserStatusMaster USM
      ON USM.StatusID = U.StatusID
    LEFT JOIN UserRoleMapping URM
      ON URM.UserID = U.UserID
      AND URM.IsActive = 1
    LEFT JOIN RoleMaster RM
      ON RM.RoleID = URM.RoleID
    LEFT JOIN MemberGroupMaster MGM
      ON MGM.MemberGroupID = U.MemberGroupID
    LEFT JOIN PlanMaster PM
      ON PM.PlanID = MGM.PlanID
    WHERE U.UserID = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
};

const updateEmail = async (userId, emailId) => {
  const [rows] = await db.query('CALL sp_update_account_email(?, ?)', [
    userId,
    emailId,
  ]);
  return rows[0][0];
};

const updatePhone = async (userId, mobileNumber) => {
  const [rows] = await db.query('CALL sp_update_account_phone(?, ?)', [
    userId,
    mobileNumber,
  ]);
  return rows[0][0];
};

const updatePlan = async (userId, planId, paymentTransactionId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [accountRows] = await connection.query(
      `
      SELECT U.MemberGroupID, MGM.PlanID AS CurrentPlanID
      FROM UserMaster U
      LEFT JOIN MemberGroupMaster MGM
        ON MGM.MemberGroupID = U.MemberGroupID
      WHERE U.UserID = ?
        AND U.StatusID = 1
      LIMIT 1
      `,
      [userId]
    );

    const account = accountRows[0];

    if (!account?.MemberGroupID) {
      await connection.rollback();
      return {
        IsSuccess: 0,
        Message: 'Active account plan was not found',
      };
    }

    const [planRows] = await connection.query(
      `
      SELECT PlanID
      FROM PlanMaster
      WHERE PlanID = ?
        AND IsActive = 1
      LIMIT 1
      `,
      [planId]
    );

    if (planRows.length === 0) {
      await connection.rollback();
      return {
        IsSuccess: 0,
        Message: 'The selected plan is unavailable',
      };
    }

    if (Number(account.CurrentPlanID) === Number(planId)) {
      await connection.rollback();
      return {
        IsSuccess: 0,
        Message: 'Please select a different plan',
      };
    }

    await connection.query(
      `
      UPDATE MemberGroupMaster
      SET PlanID = ?,
          PlanStartDate = NOW(),
          PlanEndDate = DATE_ADD(NOW(), INTERVAL 1 YEAR),
          IsPlanActive = 1,
          UpdatedBy = ?,
          UpdatedDate = NOW()
      WHERE MemberGroupID = ?
      `,
      [planId, userId, account.MemberGroupID]
    );

    await connection.commit();

    return {
      IsSuccess: 1,
      Message: 'Plan updated successfully',
      MemberGroupID: account.MemberGroupID,
      PlanID: planId,
      PaymentTransactionID: paymentTransactionId || null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const removeAccount = async (userId) => {
  const [rows] = await db.query('CALL sp_remove_account(?)', [userId]);
  return rows[0][0];
};

module.exports = {
  getProfile,
  updateEmail,
  updatePhone,
  updatePlan,
  removeAccount,
};
