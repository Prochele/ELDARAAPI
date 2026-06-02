const crypto = require('crypto');
const env = require('../config/env');
const emailUtil = require('../utils/email.util');
const paymentRepository = require('../repositories/payment.repository');

const PREMIUM_PLAN_ID = 3;

const getPremiumAmountPaise = () => {
  const amountInr = Number(env.PREMIUM_PLAN_AMOUNT_INR || 599);
  return Math.round(amountInr * 100);
};

const getCurrency = () => env.RAZORPAY_CURRENCY || 'INR';

const assertRazorpayConfig = () => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay test keys are not configured');
  }
};

const createRazorpayOrder = async (payload) => {
  assertRazorpayConfig();

  const amountPaise = getPremiumAmountPaise();
  const currency = getCurrency();
  const receipt = `premium_${Date.now()}`;

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency,
      receipt,
      notes: {
        planId: String(PREMIUM_PLAN_ID),
        planName: 'Premium Family',
        mobileNumber: payload.mobileNumber || '',
        emailId: payload.emailId || '',
      },
    }),
  });

  const order = await response.json();

  if (!response.ok) {
    throw new Error(order?.error?.description || 'Unable to create Razorpay order');
  }

  const paymentTransactionId = await paymentRepository.createTransaction({
    planId: PREMIUM_PLAN_ID,
    orderId: order.id,
    amountPaise,
    currency,
    firstName: payload.firstName,
    lastName: payload.lastName,
    mobileNumber: payload.mobileNumber,
    emailId: payload.emailId,
  });

  return {
    keyId: env.RAZORPAY_KEY_ID,
    orderId: order.id,
    amount: amountPaise,
    currency,
    paymentTransactionId,
    planId: PREMIUM_PLAN_ID,
    planName: 'Premium Family',
  };
};

const verifyPayment = async (payload) => {
  assertRazorpayConfig();

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = payload;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return {
      success: false,
      message: 'Payment verification details are required',
    };
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    await paymentRepository.markTransactionFailed({
      orderId: razorpayOrderId,
      failureCode: 'SIGNATURE_VERIFICATION_FAILED',
      failureDescription: 'Payment signature verification failed',
      failureSource: 'API_VERIFY',
      providerErrorRaw: JSON.stringify({
        razorpayOrderId,
        razorpayPaymentId,
      }),
    });

    return {
      success: false,
      message: 'Payment signature verification failed',
    };
  }

  const transaction = await paymentRepository.markTransactionVerified({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!transaction) {
    return {
      success: false,
      message: 'Payment transaction was not found or already used',
    };
  }

  try {
    await emailUtil.sendPremiumInvoiceEmail({
      toEmail: transaction.EmailID,
      invoiceNumber: `INV-${transaction.PaymentTransactionID}`,
      paymentTransactionId: transaction.PaymentTransactionID,
      firstName: transaction.FirstName,
      lastName: transaction.LastName,
      mobileNumber: transaction.MobileNumber,
      planName: 'ELDARA Premium Family Plan',
      amountPaise: transaction.AmountPaise,
      currency: transaction.Currency,
      orderId: transaction.ProviderOrderID,
      paymentId: transaction.ProviderPaymentID,
      paymentDate: transaction.VerifiedOn,
    });
  } catch (error) {
    console.error('Premium invoice email send failed:', error);
  }

  return {
    success: true,
    message: 'Payment verified successfully',
  };
};

const recordPaymentFailure = async (payload) => {
  assertRazorpayConfig();

  if (!payload.razorpayOrderId) {
    return {
      success: false,
      message: 'Razorpay order id is required to record payment failure',
    };
  }

  await paymentRepository.markTransactionFailed({
    orderId: payload.razorpayOrderId,
    failureCode: payload.failureCode,
    failureDescription: payload.failureDescription,
    failureSource: payload.failureSource || 'RAZORPAY_CHECKOUT',
    providerErrorRaw: payload.providerErrorRaw
      ? JSON.stringify(payload.providerErrorRaw)
      : null,
  });

  return {
    success: true,
    message: 'Payment failure recorded successfully',
  };
};

module.exports = {
  PREMIUM_PLAN_ID,
  createRazorpayOrder,
  recordPaymentFailure,
  verifyPayment,
};
