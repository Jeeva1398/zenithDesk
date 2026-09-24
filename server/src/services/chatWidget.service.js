const crypto = require('crypto');
const { URL } = require('url');
const pool = require('../db/connection');
const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');

const DEFAULT_THEME = {
  primaryColor: '#2563eb',
  primaryTextColor: '#ffffff',
  botBubbleColor: '#f1f5f9',
  botTextColor: '#0f172a',
  panelBackground: '#ffffff',
  fontFamily: 'system',
  cornerRadius: 12,
  bubbleRadius: 12,
  position: 'right',
  launcherIcon: 'chat',
  title: 'Support',
  subtitle: '',
  placeholder: 'Describe your issue...',
  greeting: '',
  logoUrl: '',
};

// Every type the server is able to verify by its leading bytes. An org picks a
// subset; it can never widen this list, because a file is only accepted once
// its contents have been checked against one of these signatures.
const ATTACHMENT_TYPES = ['png', 'jpg', 'webp', 'gif', 'pdf'];
const MAX_ATTACHMENT_MB = 10;

const DEFAULT_TOOLS = {
  attachments: { enabled: true, maxMb: 5, types: ['png', 'jpg', 'webp', 'pdf'] },
};

const MAX_DOMAINS = 20;

// Each theme field is checked on its own terms rather than by one loose rule,
// because every one of them lands in CSS or markup on someone else's website.
const HEX = /^#[0-9a-f]{6}$/i;
const THEME_RULES = {
  primaryColor: { type: 'color' },
  primaryTextColor: { type: 'color' },
  botBubbleColor: { type: 'color' },
  botTextColor: { type: 'color' },
  panelBackground: { type: 'color' },
  fontFamily: { type: 'enum', values: ['system', 'serif', 'mono', 'rounded'] },
  cornerRadius: { type: 'int', min: 0, max: 24 },
  bubbleRadius: { type: 'int', min: 0, max: 22 },
  position: { type: 'enum', values: ['right', 'left'] },
  launcherIcon: { type: 'enum', values: ['chat', 'logo'] },
  title: { type: 'text', max: 40, required: true },
  subtitle: { type: 'text', max: 60 },
  placeholder: { type: 'text', max: 60, required: true },
  greeting: { type: 'text', max: 200 },
  logoUrl: { type: 'url', max: 500 },
};

function generatePublicKey() {
  return `zdw_${crypto.randomBytes(16).toString('hex')}`;
}

// mysql2 hands a JSON column back already parsed, but a value written as a
// string literal (the migration's backfill) can come back as text on some
// server versions, so both are accepted.
function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function validateThemeField(field, value) {
  const rule = THEME_RULES[field];

  switch (rule.type) {
    case 'color':
      if (typeof value !== 'string' || !HEX.test(value)) {
        throw new ApiError(400, `theme.${field} must be a hex colour like #2563eb`);
      }
      return value.toLowerCase();
    case 'enum':
      if (!rule.values.includes(value)) {
        throw new ApiError(400, `theme.${field} must be one of: ${rule.values.join(', ')}`);
      }
      return value;
    case 'int': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < rule.min || n > rule.max) {
        throw new ApiError(400, `theme.${field} must be a whole number between ${rule.min} and ${rule.max}`);
      }
      return n;
    }
    case 'text': {
      if (typeof value !== 'string') {
        throw new ApiError(400, `theme.${field} must be text`);
      }
      const text = value.trim();
      if (rule.required && !text) {
        throw new ApiError(400, `theme.${field} cannot be empty`);
      }
      if (text.length > rule.max) {
        throw new ApiError(400, `theme.${field} must be at most ${rule.max} characters`);
      }
      return text;
    }
    case 'url': {
      if (typeof value !== 'string') {
        throw new ApiError(400, `theme.${field} must be a URL`);
      }
      const text = value.trim();
      if (!text) return '';
      // https only: the logo is loaded into pages that are themselves served
      // over https, where an http image is blocked as mixed content anyway.
      let url;
      try {
        url = new URL(text);
      } catch {
        throw new ApiError(400, `theme.${field} must be a valid https URL`);
      }
      if (url.protocol !== 'https:' || text.length > rule.max) {
        throw new ApiError(400, `theme.${field} must be an https URL of at most ${rule.max} characters`);
      }
      return url.toString();
    }
    default:
      throw new Error(`Unhandled theme rule ${rule.type}`);
  }
}

function sanitizeTheme(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ApiError(400, 'theme must be an object');
  }

  const theme = {};
  for (const [field, value] of Object.entries(input)) {
    if (!THEME_RULES[field]) {
      throw new ApiError(400, `Unknown theme field: ${field}`);
    }
    theme[field] = validateThemeField(field, value);
  }
  return theme;
}

function sanitizeTools(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ApiError(400, 'tools must be an object');
  }

  const tools = {};
  for (const [tool, value] of Object.entries(input)) {
    if (tool !== 'attachments') {
      throw new ApiError(400, `Unknown tool: ${tool}`);
    }
    if (typeof value !== 'object' || value === null) {
      throw new ApiError(400, 'tools.attachments must be an object');
    }

    const attachments = { ...DEFAULT_TOOLS.attachments };
    if (value.enabled !== undefined) {
      if (typeof value.enabled !== 'boolean') {
        throw new ApiError(400, 'tools.attachments.enabled must be true or false');
      }
      attachments.enabled = value.enabled;
    }
    if (value.maxMb !== undefined) {
      const mb = Number(value.maxMb);
      if (!Number.isInteger(mb) || mb < 1 || mb > MAX_ATTACHMENT_MB) {
        throw new ApiError(400, `tools.attachments.maxMb must be a whole number between 1 and ${MAX_ATTACHMENT_MB}`);
      }
      attachments.maxMb = mb;
    }
    if (value.types !== undefined) {
      if (!Array.isArray(value.types) || value.types.some((t) => !ATTACHMENT_TYPES.includes(t))) {
        throw new ApiError(400, `tools.attachments.types may only contain: ${ATTACHMENT_TYPES.join(', ')}`);
      }
      const types = [...new Set(value.types)];
      if (attachments.enabled && types.length === 0) {
        throw new ApiError(400, 'Choose at least one attachment type, or turn attachments off');
      }
      attachments.types = types;
    }
    tools.attachments = attachments;
  }
  return tools;
}

// Stored as bare origins (scheme://host[:port]) because that is exactly what a
// browser sends in the Origin header, so the chatbot can compare with ===
// rather than parsing. A bare hostname is taken to mean https.
function normalizeDomain(entry) {
  if (typeof entry !== 'string' || !entry.trim()) {
    throw new ApiError(400, 'allowedDomains entries must be non-empty text');
  }
  const text = entry.trim();
  if (text.includes('*')) {
    throw new ApiError(400, `Wildcards are not supported: ${text} - list each site separately`);
  }

  let url;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new ApiError(400, `Not a valid site address: ${text}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ApiError(400, `Only http and https sites can embed the widget: ${text}`);
  }
  return url.origin;
}

function sanitizeDomains(input) {
  if (!Array.isArray(input)) {
    throw new ApiError(400, 'allowedDomains must be a list');
  }
  const domains = [...new Set(input.map(normalizeDomain))];
  if (domains.length > MAX_DOMAINS) {
    throw new ApiError(400, `At most ${MAX_DOMAINS} sites can be allowed`);
  }
  return domains;
}

function present(row) {
  const tools = parseJson(row.tools, {});
  return {
    publicKey: row.public_key,
    allowedDomains: parseJson(row.allowed_domains, []),
    theme: { ...DEFAULT_THEME, ...parseJson(row.theme, {}) },
    tools: {
      attachments: { ...DEFAULT_TOOLS.attachments, ...(tools.attachments || {}) },
    },
  };
}

async function seedDefaults(connection, orgId) {
  await connection.query(
    `INSERT INTO chat_widget_settings
       (org_id, public_key, allowed_domains, theme, tools, created_at, updated_at)
     VALUES (?, ?, '[]', '{}', '{}', NOW(), NOW())`,
    [orgId, generatePublicKey()],
  );
}

async function getSettings(orgId) {
  const row = await forOrg(orgId).get('chat_widget_settings', {}, 'Chat widget settings not found');
  return present(row);
}

async function updateSettings(orgId, { theme, tools, allowedDomains }) {
  const db = forOrg(orgId);
  const row = await db.get('chat_widget_settings', {}, 'Chat widget settings not found');
  const updates = {};

  if (theme !== undefined) {
    updates.theme = JSON.stringify({ ...parseJson(row.theme, {}), ...sanitizeTheme(theme) });
  }
  if (tools !== undefined) {
    updates.tools = JSON.stringify({ ...parseJson(row.tools, {}), ...sanitizeTools(tools) });
  }
  if (allowedDomains !== undefined) {
    updates.allowed_domains = JSON.stringify(sanitizeDomains(allowedDomains));
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  await db.update('chat_widget_settings', { id: row.id }, updates, 'Chat widget settings not found');
  return getSettings(orgId);
}

// The old key stops working at once, which is the point: it is how an admin
// cuts off a site that copied the snippet.
async function regenerateKey(orgId) {
  await forOrg(orgId).update(
    'chat_widget_settings',
    {},
    { public_key: generatePublicKey() },
    'Chat widget settings not found',
  );
  return getSettings(orgId);
}

// The chatbot's lookup: key in, org and settings out. There is no org context
// yet - finding the org is what the key is for.
async function getPublicConfig(publicKey) {
  if (typeof publicKey !== 'string' || !/^zdw_[0-9a-f]{32}$/.test(publicKey)) {
    throw new ApiError(404, 'Unknown widget key');
  }

  const [rows] = await pool.query(
    '/* unscoped: widget key lookup, which is how the org is found */ SELECT * FROM chat_widget_settings WHERE public_key = ?',
    [publicKey],
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Unknown widget key');
  }

  const { theme, tools, allowedDomains } = present(rows[0]);
  return { orgId: rows[0].org_id, theme, tools, allowedDomains };
}

module.exports = {
  DEFAULT_THEME,
  DEFAULT_TOOLS,
  ATTACHMENT_TYPES,
  MAX_ATTACHMENT_MB,
  seedDefaults,
  getSettings,
  updateSettings,
  regenerateKey,
  getPublicConfig,
  normalizeDomain,
};
