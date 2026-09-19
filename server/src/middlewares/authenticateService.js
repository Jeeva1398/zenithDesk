const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { verifyToken, TOKEN_TYPES } = require('../utils/token');

// Accepts either a normal agent token or a service token, and is the only place
// a service token is accepted at all. The chatbot needs to raise a ticket for a
// customer it has verified; it has no business reading the queue, so its token
// reaches exactly one route rather than inheriting agent access to all of them.
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

  req.agent = {
    id: type === TOKEN_TYPES.SERVICE ? null : payload.agentId,
    orgId: payload.orgId,
    role: type === TOKEN_TYPES.SERVICE ? 'service' : payload.role,
    email: payload.email,
  };
  next();
});

module.exports = authenticateAgentOrService;
