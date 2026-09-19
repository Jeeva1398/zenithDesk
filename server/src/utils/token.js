const jwt = require('jsonwebtoken');

// Every token in this app is signed with the same JWT_SECRET, so the payload
// itself is the only thing distinguishing an agent token from a customer or
// super-admin one. Without an explicit type claim, a token minted for one
// audience verifies happily against another's middleware — a customer's OTP
// token would satisfy `authenticate` and inherit org-wide agent access. `typ`
// is that discriminator, and `verifyToken` refuses to return a payload whose
// type isn't the one the caller asked for.
const TOKEN_TYPES = {
  AGENT: 'agent',
  CUSTOMER: 'customer',
  SUPER_ADMIN: 'super_admin',
  // A machine caller (the chatbot) that may create a ticket on a customer's
  // behalf and do nothing else. Deliberately not an agent token: that one can
  // read every ticket and customer in the org.
  SERVICE: 'service',
};

function signToken(payload, options = {}) {
  if (!payload.typ) {
    throw new Error('signToken requires a `typ` claim (see TOKEN_TYPES)');
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: options.expiresIn || process.env.JWT_EXPIRES_IN || '1d',
  });
}

// Returns the payload, or throws a plain Error the caller converts into the
// 401/403 it wants. Tokens issued before `typ` existed have no type at all and
// are rejected rather than grandfathered in — failing closed here just costs
// everyone one re-login, whereas failing open leaves the escalation path open.
function verifyToken(token, expectedType) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new Error('Invalid or expired token');
  }

  if (payload.typ !== expectedType) {
    throw new Error('Token is not valid for this endpoint');
  }

  return payload;
}

module.exports = { signToken, verifyToken, TOKEN_TYPES };
