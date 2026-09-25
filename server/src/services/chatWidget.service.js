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
  // The widget's home screen: what it opens on before a conversation starts.
  homeTitle: 'How can we help?',
  homeSubtitle: '',
  // Up to six "Explore" cards; tapping one asks its title. Empty means the
  // widget shows the bot's own opening choices instead.
  topics: [],
  privacyNotice: 'Please do not share passwords or payment details in this chat.',
  showPoweredBy: true,
};

const MAX_TOPICS = 6;

// Every type the server is able to verify by its leading bytes. An org picks a
// subset; it can never widen this list, because a file is only accepted once
// its contents have been checked against one of these signatures.
const ATTACHMENT_TYPES = ['png', 'jpg', 'webp', 'gif', 'pdf'];
const MAX_ATTACHMENT_MB = 10;

const DEFAULT_TOOLS = {
  attachments: { enabled: true, maxMb: 5, types: ['png', 'jpg', 'webp', 'pdf'] },
};

const MAX_DOMAINS = 20;

// Which jobs the bot does. The defaults are what it did before this setting
// existed, so an org that never opens it sees no change.
const BOT_PURPOSES = ['enquiry', 'support', 'knowledge', 'status'];
const DEFAULT_BOT = {
  purposes: { enquiry: false, support: true, knowledge: true, status: true },
  companyDescription: '',
  outOfScopeMessage: '',
  enquiryAlertEmail: '',
};
const BOT_TEXT_LIMITS = { companyDescription: 500, outOfScopeMessage: 300 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  homeTitle: { type: 'text', max: 80, required: true },
  homeSubtitle: { type: 'text', max: 140 },
  topics: { type: 'topics' },
  privacyNotice: { type: 'text', max: 200 },
  showPoweredBy: { type: 'bool' },
};

function cleanTopicText(value, field, max, required) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') {
    throw new ApiError(400, `theme.topics ${field} must be text`);
  }
  const text = value.trim();
  if (required && !text) throw new ApiError(400, `Every topic needs a ${field}`);
  if (text.length > max) throw new ApiError(400, `A topic ${field} must be at most ${max} characters`);
  return text;
}

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
    case 'bool':
      if (typeof value !== 'boolean') {
        throw new ApiError(400, `theme.${field} must be true or false`);
      }
      return value;
    case 'topics': {
      if (!Array.isArray(value) || value.length > MAX_TOPICS) {
        throw new ApiError(400, `theme.topics must be a list of at most ${MAX_TOPICS} topics`);
      }
      return value.map((topic) => {
        if (typeof topic !== 'object' || topic === null || Array.isArray(topic)) {
          throw new ApiError(400, 'Each topic must have a title');
        }
        return {
          title: cleanTopicText(topic.title, 'title', 40, true),
          subtitle: cleanTopicText(topic.subtitle, 'subtitle', 60, false),
        };
      });
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

// Accepts a partial bot object and returns it checked, merged over what is
// already stored, because the purposes have to be judged as a whole: the bot
// must be left with at least one thing to do.
function sanitizeBot(input, current) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ApiError(400, 'bot must be an object');
  }

  const bot = { ...current, purposes: { ...current.purposes } };
  for (const [field, value] of Object.entries(input)) {
    if (field === 'purposes') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ApiError(400, 'bot.purposes must be an object');
      }
      for (const [purpose, on] of Object.entries(value)) {
        if (!BOT_PURPOSES.includes(purpose)) {
          throw new ApiError(400, `Unknown bot purpose: ${purpose}`);
        }
        if (typeof on !== 'boolean') {
          throw new ApiError(400, `bot.purposes.${purpose} must be true or false`);
        }
        bot.purposes[purpose] = on;
      }
    } else if (field in BOT_TEXT_LIMITS) {
      if (typeof value !== 'string') {
        throw new ApiError(400, `bot.${field} must be text`);
      }
      const text = value.trim();
      if (text.length > BOT_TEXT_LIMITS[field]) {
        throw new ApiError(400, `bot.${field} must be at most ${BOT_TEXT_LIMITS[field]} characters`);
      }
      bot[field] = text;
    } else if (field === 'enquiryAlertEmail') {
      const text = typeof value === 'string' ? value.trim() : null;
      if (text === null || (text && (!EMAIL.test(text) || text.length > 255))) {
        throw new ApiError(400, 'bot.enquiryAlertEmail must be an email address');
      }
      bot.enquiryAlertEmail = text.toLowerCase();
    } else {
      throw new ApiError(400, `Unknown bot field: ${field}`);
    }
  }

  if (!BOT_PURPOSES.some((purpose) => bot.purposes[purpose])) {
    throw new ApiError(400, 'Turn on at least one thing for the bot to do');
  }
  return bot;
}

function presentBot(stored) {
  const bot = parseJson(stored, {});
  return {
    ...DEFAULT_BOT,
    ...bot,
    purposes: { ...DEFAULT_BOT.purposes, ...(bot.purposes || {}) },
  };
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
    bot: presentBot(row.bot),
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

async function updateSettings(orgId, { theme, tools, allowedDomains, bot }) {
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
  if (bot !== undefined) {
    updates.bot = JSON.stringify(sanitizeBot(bot, presentBot(row.bot)));
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

const KEY_PATTERN = /^zdw_[0-9a-f]{32}$/;

async function findByKey(publicKey) {
  if (typeof publicKey !== 'string' || !KEY_PATTERN.test(publicKey)) return null;

  const [rows] = await pool.query(
    '/* unscoped: widget key lookup, which is how the org is found */ SELECT * FROM chat_widget_settings WHERE public_key = ?',
    [publicKey],
  );
  return rows[0] || null;
}

// The chatbot's lookup: key in, org and settings out. There is no org context
// yet - finding the org is what the key is for.
async function getPublicConfig(publicKey) {
  const row = await findByKey(publicKey);
  if (!row) {
    throw new ApiError(404, 'Unknown widget key');
  }

  // The alert address stays behind: this response is unauthenticated, and the
  // bot only needs to know what to do, not whom the main app will email.
  const { theme, tools, allowedDomains, bot } = present(row);
  const publicBot = { ...bot };
  delete publicBot.enquiryAlertEmail;
  return { orgId: row.org_id, theme, tools, allowedDomains, bot: publicBot };
}

// The bot settings as the main app itself sees them, alert address included.
async function getBotSettings(orgId) {
  const row = await forOrg(orgId).get('chat_widget_settings', {}, 'Chat widget settings not found', {
    columns: 'bot',
  });
  return presentBot(row.bot);
}

// Which org a widget key belongs to, or null. A platform service token acts
// for whichever org the widget it names belongs to.
async function findOrgIdByKey(publicKey) {
  const row = await findByKey(publicKey);
  return row ? row.org_id : null;
}

module.exports = {
  DEFAULT_THEME,
  DEFAULT_TOOLS,
  DEFAULT_BOT,
  ATTACHMENT_TYPES,
  MAX_ATTACHMENT_MB,
  seedDefaults,
  getSettings,
  updateSettings,
  regenerateKey,
  getPublicConfig,
  getBotSettings,
  findOrgIdByKey,
  normalizeDomain,
};
