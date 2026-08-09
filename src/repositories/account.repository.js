const db = require('../config/db');

const getProfile = async (userId) => {
  const [rows] = await db.query('CALL sp_get_account_profile(?)', [userId]);
  return rows[0][0] || null;
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
