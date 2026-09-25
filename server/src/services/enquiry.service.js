const pool = require('../db/connection');
const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const chatWidgetService = require('./chatWidget.service');
const { sendEnquiryAlert } = require('./email.service');

const STATUSES = ['new', 'contacted', 'closed'];
const LIMITS = { name: 100, email: 255, phone: 30, company: 150, message: 5000, notes: 5000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits with the usual separators and an optional leading +. Loose on
// purpose: formats differ by country and the number is read by a person.
const PHONE = /^\+?[0-9()\-.\s]+$/;
const MIN_PHONE_DIGITS = 6;
const MAX_PAGE_SIZE = 100;
const COLUMNS = 'id, name, email, phone, company, message, status, notes, source, created_at, updated_at';

function optionalText(value, field) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ApiError(400, `${field} must be text`);
  const text = value.trim();
  if (text.length > LIMITS[field]) throw new ApiError(400, `${field} must be at most ${LIMITS[field]} characters`);
  return text || null;
}

// Name is always required, and so is a way to reach the person: an email, a
// phone number, or both.
function validateNew(input) {
  const name = optionalText(input.name, 'name');
  if (!name) throw new ApiError(400, 'name is required');

  const email = optionalText(input.email, 'email');
  if (email && !EMAIL.test(email)) throw new ApiError(400, 'email must be a valid email address');

  const phone = optionalText(input.phone, 'phone');
  if (phone && (!PHONE.test(phone) || phone.replace(/\D/g, '').length < MIN_PHONE_DIGITS)) {
    throw new ApiError(400, 'phone must be a valid phone number');
  }
  if (!email && !phone) throw new ApiError(400, 'An email or a phone number is required');

  const message = optionalText(input.message, 'message');
  if (!message) throw new ApiError(400, 'message is required');

  return {
    name,
    email: email ? email.toLowerCase() : null,
    phone,
    company: optionalText(input.company, 'company'),
    message,
  };
}

async function alertOrg(orgId, enquiry) {
  const { enquiryAlertEmail } = await chatWidgetService.getBotSettings(orgId);
  if (!enquiryAlertEmail) return;

  const [rows] = await pool.query('SELECT name FROM organizations WHERE id = ?', [orgId]);
  await sendEnquiryAlert(enquiryAlertEmail, { orgName: rows[0]?.name || 'your organization', enquiry });
}

async function createEnquiry(orgId, input) {
  const { purposes } = await chatWidgetService.getBotSettings(orgId);
  if (!purposes.enquiry) {
    throw new ApiError(409, 'This organization does not take enquiries through the chat widget');
  }

  const db = forOrg(orgId);
  const id = await db.insert('enquiries', { ...validateNew(input), source: 'chat' });
  const enquiry = await db.get('enquiries', id, 'Enquiry not found', { columns: COLUMNS });

  // The enquiry is saved either way; a mail outage must not make the chatbot
  // tell a customer their enquiry failed.
  alertOrg(orgId, enquiry).catch((err) => {
    logger.error(`Enquiry ${id} alert email failed: ${err.message}`);
  });
  return enquiry;
}

async function listEnquiries(orgId, { status, q, page, pageSize } = {}) {
  const db = forOrg(orgId);
  const size = pageSize === undefined ? 25 : Number(pageSize);
  const pageNumber = page === undefined ? 1 : Number(page);
  if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
    throw new ApiError(400, `pageSize must be a whole number between 1 and ${MAX_PAGE_SIZE}`);
  }
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new ApiError(400, 'page must be a whole number from 1');
  }
  if (status !== undefined && status !== '' && !STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${STATUSES.join(', ')}`);
  }

  const clauses = ['org_id = :orgId'];
  const params = [];
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }
  if (typeof q === 'string' && q.trim()) {
    const like = `%${q.trim().replace(/[\\%_]/g, '\\$&')}%`;
    clauses.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR company LIKE ?)');
    params.push(like, like, like, like);
  }
  const where = clauses.join(' AND ');

  const [{ total }] = await db.sql(`SELECT COUNT(*) AS total FROM enquiries WHERE ${where}`, params);
  const rows = await db.sql(
    `SELECT ${COLUMNS} FROM enquiries WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, size, (pageNumber - 1) * size],
  );
  const countRows = await db.sql(
    'SELECT status, COUNT(*) AS n FROM enquiries WHERE org_id = :orgId GROUP BY status',
  );
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of countRows) counts[row.status] = Number(row.n);

  return { enquiries: rows, total: Number(total), page: pageNumber, pageSize: size, counts };
}

async function getEnquiry(orgId, id) {
  return forOrg(orgId).get('enquiries', id, 'Enquiry not found', { columns: COLUMNS });
}

async function updateEnquiry(orgId, id, { status, notes }) {
  const updates = {};
  if (status !== undefined) {
    if (!STATUSES.includes(status)) throw new ApiError(400, `status must be one of: ${STATUSES.join(', ')}`);
    updates.status = status;
  }
  if (notes !== undefined) {
    updates.notes = optionalText(notes, 'notes');
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  const db = forOrg(orgId);
  await db.update('enquiries', id, updates, 'Enquiry not found');
  return db.get('enquiries', id, 'Enquiry not found', { columns: COLUMNS });
}

module.exports = { STATUSES, createEnquiry, listEnquiries, getEnquiry, updateEnquiry };
