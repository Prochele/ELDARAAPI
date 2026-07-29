const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
require('dotenv').config();

const DEFAULT_OTP_TEMPLATE =
  'Your ELDARA OTP is {otp}. Do not share this code with anyone.';

const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'ap-south-1'
});

const requiredConfig = (name, fallback) => {
  const value = process.env[name]?.trim() || fallback;

  if (!value) {
    throw new Error(`Missing required SMS configuration: ${name}`);
  }

  return value;
};

const formatIndiaPhoneNumber = (mobileNumber) => {
  const digits = String(mobileNumber || '').replace(/\D/g, '');

  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  throw new Error('Mobile number must be a valid Indian number');
};

const buildOtpMessage = (otp) => {
  const template = process.env.SMS_OTP_TEMPLATE || DEFAULT_OTP_TEMPLATE;

  if (!template.includes('{otp}')) {
    throw new Error('SMS_OTP_TEMPLATE must contain the {otp} placeholder');
  }

  return template.replace('{otp}', String(otp));
};

const buildMessageAttributes = () => ({
  'AWS.SNS.SMS.SMSType': {
    DataType: 'String',
    StringValue: 'Transactional'
  },
  'AWS.SNS.SMS.SenderID': {
    DataType: 'String',
    StringValue: requiredConfig('SMS_SENDER_ID', 'ELDARA')
  },
  'AWS.MM.SMS.EntityId': {
    DataType: 'String',
    StringValue: requiredConfig('SMS_DLT_ENTITY_ID', '1201178054847000687')
  },
  'AWS.MM.SMS.TemplateId': {
    DataType: 'String',
    StringValue: requiredConfig('SMS_DLT_TEMPLATE_ID', '1207178281269952338')
  }
});

exports.sendOtpSms = async (mobileNumber, otp) => {
  const params = {
    Message: buildOtpMessage(otp),
    PhoneNumber: formatIndiaPhoneNumber(mobileNumber),
    MessageAttributes: buildMessageAttributes()
  };

  try {
    const response = await snsClient.send(new PublishCommand(params));

    console.log('SMS accepted by AWS SNS:', response.MessageId);
    return response;
  } catch (error) {
    console.error('SMS sending failed:', error.message);
    throw error;
  }
};

exports.formatIndiaPhoneNumber = formatIndiaPhoneNumber;
exports.buildOtpMessage = buildOtpMessage;
exports.buildMessageAttributes = buildMessageAttributes;
