const db = require('../../config/db');

exports.generateLoginOtp = async (mobileNumber) => {
    const [rows] = await db.query(
        'CALL sp_generate_login_otp(?)',
        [mobileNumber]
    );
    return rows[0][0];
};

exports.verifyLoginOtp = async (mobileNumber, otp) => {
    const [rows] = await db.query(
        'CALL sp_verify_login_otp(?, ?)',
        [mobileNumber, otp]
    );
    return rows[0][0];
};