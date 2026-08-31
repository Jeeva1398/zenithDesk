const { Resend } = require('resend');
const logger = require('../config/logger');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendOtpEmail(to, code) {
  if (!resend) {
    logger.warn(`RESEND_API_KEY not set — logging OTP instead of emailing ${to}: ${code}`);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject: 'Your ZenithDesk verification code',
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
  });
}

module.exports = { sendOtpEmail };
