// src/utils/email.util.js

const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const sesClient = new SESClient({
    region: process.env.AWS_REGION,
});

const INVOICE_SOURCE_EMAIL = process.env.INVOICE_FROM_EMAIL || "info@prochele.com";
const INVOICE_SOURCE_NAME = "Prochele Software Solutions Private Limited";
const INVOICE_SOURCE = `${INVOICE_SOURCE_NAME} <${INVOICE_SOURCE_EMAIL}>`;

const COMPANY_DETAILS = {
    name: INVOICE_SOURCE_NAME,
    cin: "U62013TN2025PTC184448",
    pan: "AAQCP1913L",
    tan: "CHEP29478B",
    phone: "+919043592910",
    email: INVOICE_SOURCE_EMAIL,
    address: "264, Door No: F/22, F-Block, 2nd Main Road Anna Nagar, Anna Nagar East, Perambur Purasawalkam, Chennai - 600102, Tamil Nadu",
};

const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const formatCurrency = (amountPaise, currency) => {
    const amount = Number(amountPaise || 0) / 100;
    return `${currency || "INR"} ${amount.toFixed(2)}`;
};

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
        Source: INVOICE_SOURCE_EMAIL
    };

    const command = new SendEmailCommand(params);

    return await sesClient.send(command);
};

exports.sendPlanInvoiceEmail = async (invoice) => {
    if (!invoice?.toEmail) {
        throw new Error("Invoice email recipient is required");
    }

    const invoiceNumber = invoice.invoiceNumber || `INV-${invoice.paymentTransactionId}`;
    const customerName = `${invoice.firstName || ""} ${invoice.lastName || ""}`.trim() || "Customer";
    const planName = invoice.planName || "ELDARA Plan";
    const paymentDate = invoice.paymentDate
        ? new Date(invoice.paymentDate).toLocaleDateString("en-IN")
        : new Date().toLocaleDateString("en-IN");
    const amountText = formatCurrency(invoice.amountPaise, invoice.currency);

    const params = {
        Destination: {
            ToAddresses: [invoice.toEmail]
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: `
                        <div style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.5; max-width: 720px;">
                            <h2 style="margin-bottom: 4px;">Payment Invoice</h2>
                            <p style="margin-top: 0;">Thank you for choosing ELDARA.</p>

                            <table style="width: 100%; border-collapse: collapse; margin: 18px 0;">
                                <tr>
                                    <td style="vertical-align: top; width: 55%;">
                                        <strong>${escapeHtml(COMPANY_DETAILS.name)}</strong><br/>
                                        ${escapeHtml(COMPANY_DETAILS.address)}<br/>
                                        Phone: ${escapeHtml(COMPANY_DETAILS.phone)}<br/>
                                        Email: ${escapeHtml(COMPANY_DETAILS.email)}<br/>
                                        CIN: ${escapeHtml(COMPANY_DETAILS.cin)}<br/>
                                        PAN: ${escapeHtml(COMPANY_DETAILS.pan)}<br/>
                                        TAN: ${escapeHtml(COMPANY_DETAILS.tan)}
                                    </td>
                                    <td style="vertical-align: top; text-align: right;">
                                        <strong>Invoice No:</strong> ${escapeHtml(invoiceNumber)}<br/>
                                        <strong>Invoice Date:</strong> ${escapeHtml(paymentDate)}<br/>
                                        <strong>Payment ID:</strong> ${escapeHtml(invoice.paymentId || "-")}<br/>
                                        <strong>Order ID:</strong> ${escapeHtml(invoice.orderId || "-")}
                                    </td>
                                </tr>
                            </table>

                            <h3 style="margin-bottom: 6px;">Bill To</h3>
                            <p style="margin-top: 0;">
                                ${escapeHtml(customerName)}<br/>
                                ${escapeHtml(invoice.toEmail)}<br/>
                                ${invoice.mobileNumber ? `Phone: ${escapeHtml(invoice.mobileNumber)}` : ""}
                            </p>

                            <table style="width: 100%; border-collapse: collapse; margin-top: 18px;">
                                <thead>
                                    <tr>
                                        <th style="border: 1px solid #d9e2ec; padding: 10px; text-align: left;">Description</th>
                                        <th style="border: 1px solid #d9e2ec; padding: 10px; text-align: right;">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="border: 1px solid #d9e2ec; padding: 10px;">${escapeHtml(planName)}</td>
                                        <td style="border: 1px solid #d9e2ec; padding: 10px; text-align: right;">${escapeHtml(amountText)}</td>
                                    </tr>
                                    <tr>
                                        <td style="border: 1px solid #d9e2ec; padding: 10px; text-align: right;"><strong>Total Paid</strong></td>
                                        <td style="border: 1px solid #d9e2ec; padding: 10px; text-align: right;"><strong>${escapeHtml(amountText)}</strong></td>
                                    </tr>
                                </tbody>
                            </table>

                            <p style="margin-top: 20px;">This is a system-generated invoice for your successful ELDARA plan payment.</p>
                        </div>
                    `
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: `ELDARA Plan Invoice - ${invoiceNumber}`
            }
        },
        Source: INVOICE_SOURCE
    };

    const command = new SendEmailCommand(params);

    return await sesClient.send(command);
};
