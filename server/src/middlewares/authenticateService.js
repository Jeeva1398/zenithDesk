const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { verifyToken, TOKEN_TYPES } = require('../utils/token');
const chatWidgetService = require('../services/chatWidget.service');

const WIDGET_KEY_HEADER = 'x-widget-key';

// Which org a service token is acting for. An org token carries its org. A
// platform token carries none - one chatbot serves every org, so the org comes
// from the widget the customer is typing into, named in X-Widget-Key. The key
// is public (it sits in the embed snippet), which is fine: it only says which
// org, and the token is still what proves the caller is the chatbot.
async function resolveServiceOrg(payload, widgetKey) {
  if (payload.scope === 'platform') {
    if (!widgetKey) {
      throw new ApiError(401, 'A platform service token must name its widget in X-Widget-Key');
    }
    const orgId = await chatWidgetService.findOrgIdByKey(widgetKey);
    if (!orgId) {
      throw new ApiError(403, 'Unknown widget key');
    }
    return orgId;
  }

  if (!Number.isInteger(payload.orgId)) {
    throw new ApiError(401, 'Invalid or expired token');
  }
  // An org token may name a widget too, but only one of its own. Otherwise a
  // customer on another org's widget would have their ticket filed here.
  if (widgetKey && (await chatWidgetService.findOrgIdByKey(widgetKey)) !== payload.orgId) {
    throw new ApiError(403, "This token cannot act for that widget's organization");
  }
  return payload.orgId;
}

// Accepts either a normal agent token or a service token, and is the only place
// a service token is accepted at all. The chatbot needs to raise a ticket for a
// customer, attach the files they sent, and search the published knowledge
// base; it has no business reading the queue, so its token reaches exactly
// those routes rather than inheriting agent access to all of them.
const authenticateAgentOrService = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header');
  }

  const token = header.slice('Bearer '.length);

  let payload;
  let type;
  for (const candidate of [TOKEN_TYPES.AGENT, TOKEN_TYPES.SERVICE]) {
    try {
      payload = verifyToken(token, candidate);
      type = candidate;
      break;
    } catch {
      // Wrong audience for this candidate; try the next.
    }
  }

  if (!payload) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  if (type === TOKEN_TYPES.SERVICE) {
    req.agent = {
      id: null,
      orgId: await resolveServiceOrg(payload, req.get(WIDGET_KEY_HEADER)),
      role: 'service',
    };
  } else {
    req.agent = { id: payload.agentId, orgId: payload.orgId, role: payload.role, email: payload.email };
  }
  next();
});

module.exports = authenticateAgentOrService;
