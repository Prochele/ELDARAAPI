const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const snsClient = new SNSClient({
  region: "ap-south-1"
});

exports.sendOtpSms = async (mobileNumber, otp) => {

  const message = `Your ELDARA OTP is ${otp}. Do not share this code with anyone.`;

  const params = {
    Message: message,
    PhoneNumber: mobileNumber,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional'
      }
    }
  };

  try {

    const command = new PublishCommand(params);
    const response = await snsClient.send(command);

    console.log("SMS sent successfully:", response);

    return true;

  } catch (error) {

    console.error("SMS sending failed:", error);

    return false;

  }

};