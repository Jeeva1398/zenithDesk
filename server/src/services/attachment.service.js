const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');
const { detectFileType, safeFilename } = require('../utils/fileSignature');
const chatWidgetService = require('./chatWidget.service');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));
const MAX_PER_TICKET = 10;

// The chatbot's service token may attach files only to a ticket that is still
// fresh - the one it has just raised for the customer it is talking to - rather
// than to any ticket in the org. An hour covers a customer adding a screenshot
// after the ticket number has come back.
const SERVICE_WINDOW_MINUTES = 60;

const COLUMNS = 'id, ticket_id, filename, mime_type, size_bytes, created_at';

function resolveStoragePath(storageKey) {
  const full = path.resolve(UPLOAD_DIR, storageKey);
  // storage_key is always ours, but a path that resolves outside the upload
  // directory is refused anyway rather than trusted.
  if (!full.startsWith(UPLOAD_DIR + path.sep)) {
    throw new Error(`Attachment path escapes the upload directory: ${storageKey}`);
  }
  return full;
}

async function uploadRules(orgId, caller) {
  if (caller.role !== 'service') {
    return {
      types: chatWidgetService.ATTACHMENT_TYPES,
      maxBytes: chatWidgetService.MAX_ATTACHMENT_MB * 1024 * 1024,
    };
  }

  // A widget upload is held to the org's own widget settings, so turning
  // attachments off in Settings turns them off here too, not just in the UI.
  const { tools } = await chatWidgetService.getSettings(orgId);
  if (!tools.attachments.enabled) {
    throw new ApiError(403, 'Attachments are turned off for this organization');
  }
  return { types: tools.attachments.types, maxBytes: tools.attachments.maxMb * 1024 * 1024 };
}

async function addAttachment(orgId, ticketId, file, caller) {
  if (!file || !file.buffer) {
    throw new ApiError(400, 'A file is required (multipart field "file")');
  }

  const db = forOrg(orgId);
  const ticket = await db.get('tickets', ticketId, 'Ticket not found', { columns: 'id, created_at' });

  if (caller.role === 'service') {
    const ageMinutes = (Date.now() - new Date(ticket.created_at).getTime()) / 60_000;
    if (ageMinutes > SERVICE_WINDOW_MINUTES) {
      throw new ApiError(403, 'This ticket can no longer take attachments from the chat widget');
    }
  }

  const rules = await uploadRules(orgId, caller);
  if (file.size > rules.maxBytes) {
    throw new ApiError(413, `Files can be at most ${Math.round(rules.maxBytes / 1024 / 1024)} MB`);
  }

  const detected = detectFileType(file.buffer);
  if (!detected || !rules.types.includes(detected.type)) {
    throw new ApiError(415, `Only these file types are accepted: ${rules.types.join(', ')}`);
  }

  if ((await db.count('ticket_attachments', { ticket_id: ticket.id })) >= MAX_PER_TICKET) {
    throw new ApiError(409, `A ticket can have at most ${MAX_PER_TICKET} attachments`);
  }

  const storageKey = path.posix.join(
    String(orgId),
    String(ticket.id),
    `${crypto.randomUUID()}.${detected.type}`,
  );
  const fullPath = resolveStoragePath(storageKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, file.buffer);

  let id;
  try {
    id = await db.insert('ticket_attachments', {
      ticket_id: ticket.id,
      filename: safeFilename(file.originalname, detected.type),
      mime_type: detected.mime,
      size_bytes: file.size,
      storage_key: storageKey,
    });
  } catch (err) {
    await fs.rm(fullPath, { force: true });
    throw err;
  }

  return db.get('ticket_attachments', id, 'Attachment not found', { columns: COLUMNS });
}

function listForTicket(orgId, ticketId) {
  return forOrg(orgId).list(
    'ticket_attachments',
    { ticket_id: ticketId },
    { columns: COLUMNS, orderBy: 'created_at ASC, id ASC' },
  );
}

async function getForDownload(orgId, ticketId, attachmentId) {
  const attachment = await forOrg(orgId).get(
    'ticket_attachments',
    { id: attachmentId, ticket_id: ticketId },
    'Attachment not found',
  );

  const fullPath = resolveStoragePath(attachment.storage_key);
  try {
    await fs.access(fullPath);
  } catch {
    throw new ApiError(404, 'Attachment file is missing');
  }
  return { attachment, fullPath };
}

module.exports = { addAttachment, listForTicket, getForDownload, UPLOAD_DIR, MAX_PER_TICKET };
