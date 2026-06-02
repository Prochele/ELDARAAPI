const db = require('../config/db');

const ensurePaymentTransactionTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS PaymentTransaction (
      PaymentTransactionID BIGINT PRIMARY KEY AUTO_INCREMENT,
      PlanID INT NOT NULL,
      Provider VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',
      ProviderOrderID VARCHAR(100) NOT NULL,
      ProviderPaymentID VARCHAR(100) NULL,
      ProviderSignature VARCHAR(255) NULL,
      AmountPaise INT NOT NULL,
      Currency VARCHAR(10) NOT NULL,
      Status VARCHAR(30) NOT NULL,
      FirstName VARCHAR(100) NULL,
      LastName VARCHAR(100) NULL,
      MobileNumber VARCHAR(20) NULL,
      EmailID VARCHAR(150) NULL,
      UserID BIGINT NULL,
      MemberGroupID BIGINT NULL,
      CreatedOn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      VerifiedOn DATETIME NULL,
      UsedOn DATETIME NULL,
      UNIQUE KEY uq_payment_provider_order (ProviderOrderID),
      KEY idx_payment_status (Status),
      KEY idx_payment_user (UserID)
    )
  `);

  await ensurePaymentTransactionColumns();
};

const addColumnIfMissing = async (columnName, columnDefinition) => {
  const [rows] = await db.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'PaymentTransaction'
      AND COLUMN_NAME = ?
    LIMIT 1
    `,
    [columnName]
  );

  if (rows.length === 0) {
    await db.query(`ALTER TABLE PaymentTransaction ADD COLUMN ${columnDefinition}`);
  }
};

const ensurePaymentTransactionColumns = async () => {
  await addColumnIfMissing('FailureCode', 'FailureCode VARCHAR(100) NULL');
  await addColumnIfMissing('FailureDescription', 'FailureDescription VARCHAR(500) NULL');
  await addColumnIfMissing('FailureSource', 'FailureSource VARCHAR(100) NULL');
  await addColumnIfMissing('ProviderErrorRaw', 'ProviderErrorRaw TEXT NULL');
  await addColumnIfMissing('FailedOn', 'FailedOn DATETIME NULL');
};

const createTransaction = async (data) => {
  await ensurePaymentTransactionTable();

  const [result] = await db.query(
    `
    INSERT INTO PaymentTransaction (
      PlanID,
      Provider,
      ProviderOrderID,
      AmountPaise,
      Currency,
      Status,
      FirstName,
      LastName,
      MobileNumber,
      EmailID
    )
    VALUES (?, 'RAZORPAY', ?, ?, ?, 'CREATED', ?, ?, ?, ?)
    `,
    [
      data.planId,
      data.orderId,
      data.amountPaise,
      data.currency,
      data.firstName || null,
      data.lastName || null,
      data.mobileNumber || null,
      data.emailId || null,
    ]
  );

  return result.insertId;
};

const markTransactionVerified = async (data) => {
  await ensurePaymentTransactionTable();

  const [result] = await db.query(
    `
    UPDATE PaymentTransaction
    SET ProviderPaymentID = ?,
        ProviderSignature = ?,
        Status = 'VERIFIED',
        VerifiedOn = NOW()
    WHERE ProviderOrderID = ?
      AND Status IN ('CREATED', 'FAILED')
    `,
    [data.paymentId, data.signature, data.orderId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await db.query(
    `
    SELECT *
    FROM PaymentTransaction
    WHERE ProviderOrderID = ?
      AND ProviderPaymentID = ?
      AND Status = 'VERIFIED'
    LIMIT 1
    `,
    [data.orderId, data.paymentId]
  );

  return rows[0] || null;
};

const markTransactionFailed = async (data) => {
  await ensurePaymentTransactionTable();

  await db.query(
    `
    UPDATE PaymentTransaction
    SET Status = 'FAILED',
        FailureCode = ?,
        FailureDescription = ?,
        FailureSource = ?,
        ProviderErrorRaw = ?,
        FailedOn = NOW()
    WHERE ProviderOrderID = ?
      AND Status IN ('CREATED', 'FAILED')
    `,
    [
      data.failureCode || null,
      data.failureDescription || null,
      data.failureSource || null,
      data.providerErrorRaw || null,
      data.orderId,
    ]
  );
};

const getVerifiedUnusedTransaction = async (paymentTransactionId) => {
  await ensurePaymentTransactionTable();

  const [rows] = await db.query(
    `
    SELECT *
    FROM PaymentTransaction
    WHERE PaymentTransactionID = ?
      AND Status = 'VERIFIED'
      AND UsedOn IS NULL
    LIMIT 1
    `,
    [paymentTransactionId]
  );

  return rows[0] || null;
};

const markTransactionUsed = async (paymentTransactionId, userId, memberGroupId) => {
  await ensurePaymentTransactionTable();

  await db.query(
    `
    UPDATE PaymentTransaction
    SET Status = 'USED',
        UserID = ?,
        MemberGroupID = ?,
        UsedOn = NOW()
    WHERE PaymentTransactionID = ?
      AND Status = 'VERIFIED'
      AND UsedOn IS NULL
    `,
    [userId, memberGroupId, paymentTransactionId]
  );
};

module.exports = {
  createTransaction,
  getVerifiedUnusedTransaction,
  markTransactionFailed,
  markTransactionUsed,
  markTransactionVerified,
};
