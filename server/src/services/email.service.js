const { Resend } = require('resend');
const logger = require('../config/logger');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendOtpEmail(to, code) {
  if (!resend) {
    logger.warn(`RESEND_API_KEY not set - logging OTP instead of emailing ${to}: ${code}`);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject: 'Your ZenithDesk verification code',
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
  });
}

// Tells an org that its chat widget or contact form took down a new enquiry. Plain text only:
// every field here was typed by a stranger on a public website, and plain text
// cannot carry markup or a disguised link into the recipient's inbox.
async function sendEnquiryAlert(to, { orgName, enquiry }) {
  const what = enquiry.kind === 'message' ? 'message' : 'enquiry';
  const lines = [
    `New ${what} from your ${enquiry.source === 'form' ? 'website contact form' : 'chat widget'} for ${orgName}.`,
    '',
    `Name:    ${enquiry.name}`,
    enquiry.email ? `Email:   ${enquiry.email}` : null,
    enquiry.phone ? `Phone:   ${enquiry.phone}` : null,
    enquiry.company ? `Company: ${enquiry.company}` : null,
    '',
    'Message:',
    enquiry.message,
  ];
  if (process.env.PORTAL_URL) {
    lines.push('', `Open it: ${process.env.PORTAL_URL.replace(/\/$/, '')}/enquiries?open=${enquiry.id}`);
  }
  const text = lines.filter((line) => line !== null).join('\n');

  if (!resend) {
    logger.warn(`RESEND_API_KEY not set - logging enquiry alert instead of emailing ${to}:\n${text}`);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    ...(enquiry.email ? { replyTo: enquiry.email } : {}),
    subject: `New ${what}: ${enquiry.name}${enquiry.company ? ` (${enquiry.company})` : ''}`,
    text,
  });
}

// The "forgot password" link. Plain text, like the others.
async function sendPasswordResetEmail(to, { link, minutes }) {
  const text = [
    'Someone asked to reset the password for your ZenithDesk account.',
    '',
    `Choose a new password here (the link works once, for ${minutes} minutes):`,
    link,
    '',
    "If this wasn't you, ignore this email - your password stays as it is.",
  ].join('\n');

  if (!resend) {
    logger.warn(`RESEND_API_KEY not set - logging password reset link instead of emailing ${to}: ${link}`);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject: 'Reset your ZenithDesk password',
    text,
  });
}

module.exports = { sendOtpEmail, sendEnquiryAlert, sendPasswordResetEmail };
