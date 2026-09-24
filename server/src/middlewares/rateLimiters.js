const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

// The chatbot calls the OTP endpoints server-to-server, so req.ip is the
// chatbot host for every one of its users and they would share one bucket. It
// forwards the real caller here instead, honoured only from hosts named in
// TRUSTED_SERVICE_IPS — from anyone else the header would just be a way to
// mint a fresh bucket per request.
const CLIENT_IP_HEADER = 'x-zenithdesk-client-ip';

// An IPv4 peer on a dual-stack socket arrives as ::ffff:127.0.0.1, so a
// config entry of "127.0.0.1" would never match the req.ip it is compared
// against. Strip the prefix from both sides before comparing.
function normalizeIp(ip) {
  return (ip || '').replace(/^::ffff:/i, '');
}

const TRUSTED_SERVICE_IPS = (process.env.TRUSTED_SERVICE_IPS || '')
  .split(',')
  .map((ip) => normalizeIp(ip.trim()))
  .filter(Boolean);

function endUserIpKey(req) {
  const forwarded = req.get(CLIENT_IP_HEADER);
  if (forwarded && TRUSTED_SERVICE_IPS.includes(normalizeIp(req.ip))) {
    // ipKeyGenerator masks IPv6 down to its /64 prefix, so a caller with a
    // routable v6 range can't sidestep the limit one address at a time.
    return ipKeyGenerator(forwarded);
  }
  return ipKeyGenerator(req.ip);
}

// express-rate-limit sends its own plain response by default, which would be
// the one place in the API that doesn't match the errorHandler's shape. Route
// it through ApiError instead so clients see the same `{ error }` body here as
// everywhere else.
function rejectWith(message) {
  return (req, res, next) => next(new ApiError(429, message));
}

// Every limiter keys the same way: the declared end user when a trusted
// service is speaking for one, otherwise the caller's own address.
const common = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: endUserIpKey,
};

// Broad backstop against scripted traffic. Deliberately loose — an agent
// working a ticket queue fires a lot of legitimate requests, and the tighter
// limiters below cover the endpoints that actually matter.
const generalLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 600,
  handler: rejectWith('Too many requests — please slow down and try again shortly.'),
});

// One rateLimit instance is one bucket, so the credential endpoints get their
// own instead of sharing an "auth" limiter: ten mistyped passwords used to
// spend the signup budget too, and a burst of signups could lock out logins.

// Credential guessing: the cost of a wrong guess should grow fast, and no
// human logs in ten times in a quarter hour. Successful logins don't count.
const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: rejectWith('Too many attempts — please wait a few minutes and try again.'),
});

// Signup is an abuse surface rather than a guessing one — nobody is brute
// forcing it, but one caller shouldn't be able to spray organizations.
// Failures here are usually validation errors, so they're counted too.
const signupLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  handler: rejectWith('Too many signups from this address — please try again later.'),
});

// resolve-org tells the caller whether an address has an account, so it is an
// enumeration surface. Looser than login, because a real person legitimately
// retries it while finding the right address.
const lookupLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  handler: rejectWith('Too many lookups — please wait a few minutes and try again.'),
});

// Sending an OTP costs a real email (and real money) and is reachable without
// any credential, including via the chatbot's own public /chat endpoint. The
// service layer already caps requests per email address; this caps them per
// IP, which is what stops one caller from cycling through many addresses.
const otpRequestLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  handler: rejectWith('Too many verification codes requested — please wait before trying again.'),
});

// Verification is the brute-force surface: 6 digits is a million combinations,
// and the per-OTP attempt counter resets whenever a new code is issued.
const otpVerifyLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 15,
  skipSuccessfulRequests: true,
  handler: rejectWith('Too many verification attempts — please wait before trying again.'),
});

// The public widget-config lookup. Keys are 128 random bits, so guessing is
// hopeless anyway; this keeps anyone from trying at volume. The chatbot caches
// what it fetches, so a real widget calls this a few times an hour, not per
// message.
const widgetConfigLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 120,
  handler: rejectWith('Too many widget lookups — please try again shortly.'),
});

module.exports = {
  generalLimiter,
  widgetConfigLimiter,
  loginLimiter,
  signupLimiter,
  lookupLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
};
