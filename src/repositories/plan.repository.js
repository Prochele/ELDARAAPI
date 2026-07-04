const db = require('../config/db');

const PLAN_FIELDS = `
  PlanID,
  PlanCode,
  PlanName,
  TargetUser,
  MonthlyPrice,
  YearlyPrice,
  MaxPTProfiles,
  MaxCaretakers,
  MaxMobileLogins,
  IsKYCRequired + 0 AS IsKYCRequired
`;

const listActivePlans = async () => {
  const [rows] = await db.query(`
    SELECT ${PLAN_FIELDS}
    FROM PlanMaster
    WHERE IsActive = 1
    ORDER BY PlanID
  `);

  return rows;
};

const getActivePlanById = async (planId) => {
  const [rows] = await db.query(
    `
    SELECT ${PLAN_FIELDS}
    FROM PlanMaster
    WHERE PlanID = ?
      AND IsActive = 1
    LIMIT 1
    `,
    [planId]
  );

  return rows[0] || null;
};

module.exports = {
  getActivePlanById,
  listActivePlans,
};
