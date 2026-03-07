// src/utils/email.util.js

const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const sesClient = new SESClient({
    region: "ap-south-1"
});

exports.sendOtpEmail = async (toEmail, otp, expiry) => {

    const params = {
        Destination: {
            ToAddresses: [toEmail]
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: `
                        <h3>ELDARA Login OTP</h3>
                        <p>Your OTP is:</p>
                        <h2>${otp}</h2>
                        <p>This OTP will expire at ${expiry}</p>
                        <br/>
                        <p>If you did not request this login, please ignore this email.</p>
                    `
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: "ELDARA Login OTP"
            }
        },
        Source: "info@prochele.com"
    };

    const command = new SendEmailCommand(params);

    return await sesClient.send(command);
};